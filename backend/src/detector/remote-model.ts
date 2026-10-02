/**
 * A detection model that lives behind another service — §37's "multiple detection models
 * can be plugged in", seen from this side.
 *
 * One run, one request: the upstream is given the whole document and must answer with a
 * score for every sentence of it. That is the direction that keeps the numbers true. The
 * result screen highlights sentences, so a document score copied onto each sentence would
 * be a figure the upstream never made; an answer that covers only part of the text is
 * refused with 502 instead of padded out.
 *
 * Configuration is three variables, and nothing about this file reaches the browser:
 *
 *   DETECTION_MODEL=remote
 *   DETECTOR_MODEL_URL=https://wherever/detect     required
 *   DETECTOR_MODEL_ID=name-the-upstream-reports    optional, shown beside every score
 *   DETECTOR_MODEL_TOKEN=…                         optional bearer token
 *   DETECTOR_MODEL_TIMEOUT_MS=20000
 */
import type {
  Classification,
  ClassificationBreakdown,
  ConfidenceLevel,
} from "@/types";
import {
  DETECTION_SCORE_LINES,
  signalKind,
  type DetectionModel,
  type DocumentInput,
  type DocumentScore,
  type ParagraphInput,
  type ParagraphScore,
  type SentenceInput,
  type SentenceScore,
} from "@/lib/detection/model.ts";
import { UpstreamFailure, isClassification, isConfidence } from "../schemas/wire.ts";

export interface RemoteModelOptions {
  url: string;
  modelId: string;
  version: string;
  token: string | null;
  timeoutMs: number;
}

/** `null` when the source was selected but no upstream was named; the reason is in `modelChoice()`. */
export function remoteOptionsFromEnv(): RemoteModelOptions | null {
  const url = (process.env.DETECTOR_MODEL_URL ?? "").trim();
  if (!url) return null;
  const timeout = Number(process.env.DETECTOR_MODEL_TIMEOUT_MS ?? "20000");
  return {
    url,
    modelId: (process.env.DETECTOR_MODEL_ID ?? "").trim() || "upstream-model",
    version: (process.env.DETECTOR_MODEL_VERSION ?? "").trim() || "unknown",
    token: (process.env.DETECTOR_MODEL_TOKEN ?? "").trim() || null,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 20_000,
  };
}

export interface RemoteSentenceAnswer {
  text: string;
  aiProbability: number;
  confidence: ConfidenceLevel | null;
}

/** What an upstream owes this service before anything can be shown to a reader. */
export interface RemoteReport {
  aiProbability: number;
  humanProbability: number;
  classification: Classification;
  confidence: ConfidenceLevel;
  breakdown: ClassificationBreakdown;
  sentences: RemoteSentenceAnswer[];
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new UpstreamFailure(`The upstream model's ${field} was not a number.`);
  }
  if (value < 0 || value > 100) {
    throw new UpstreamFailure(
      `The upstream model's ${field} is ${value}, outside the 0-100 scale this app reports on.`,
    );
  }
  return value;
}

/**
 * The response, read against the shape the client's own validator insists on. Being strict
 * here is what lets the UI trust a figure: a probability on a 0-1 scale, a fifth class, or a
 * breakdown that does not add up all stop at this line rather than reaching a reader.
 */
export function parseRemoteReport(payload: unknown): RemoteReport {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new UpstreamFailure("The upstream model returned something that is not a result object.");
  }
  const body = payload as Record<string, unknown>;
  const aiProbability = asNumber(body.aiProbability, "aiProbability");
  if (!isClassification(body.classification)) {
    throw new UpstreamFailure(`The upstream model reported "${String(body.classification)}", not one of the four classes this app shows.`);
  }
  if (!isConfidence(body.confidence)) {
    throw new UpstreamFailure(`The upstream model reported a confidence of "${String(body.confidence)}", which this app cannot label.`);
  }
  const rawBreakdown = body.breakdown;
  if (typeof rawBreakdown !== "object" || rawBreakdown === null) {
    throw new UpstreamFailure("The upstream model returned no classification breakdown.");
  }
  const source = rawBreakdown as Record<string, unknown>;
  const breakdown = {
    ai_generated: asNumber(source.ai_generated, "breakdown.ai_generated"),
    ai_generated_refined: asNumber(source.ai_generated_refined, "breakdown.ai_generated_refined"),
    human_refined: asNumber(source.human_refined, "breakdown.human_refined"),
    human_written: asNumber(source.human_written, "breakdown.human_written"),
  };
  const total =
    breakdown.ai_generated + breakdown.ai_generated_refined + breakdown.human_refined + breakdown.human_written;
  if (Math.round(total) !== 100) {
    throw new UpstreamFailure(`The upstream model's four classes add up to ${total}%, not 100%.`);
  }
  if (!Array.isArray(body.sentences)) {
    throw new UpstreamFailure("The upstream model returned no per-sentence scores.");
  }
  const sentences: RemoteSentenceAnswer[] = body.sentences.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new UpstreamFailure(`Sentence ${index + 1} of the upstream result was not an object.`);
    }
    const row = item as Record<string, unknown>;
    if (typeof row.text !== "string" || row.text.trim().length === 0) {
      throw new UpstreamFailure(
        `Sentence ${index + 1} of the upstream result carries no text, so it cannot be matched to the writing.`,
      );
    }
    return {
      text: row.text,
      aiProbability: asNumber(row.aiProbability, `sentence ${index + 1} aiProbability`),
      confidence: isConfidence(row.confidence) ? row.confidence : null,
    };
  });
  return {
    aiProbability,
    humanProbability: asNumber(body.humanProbability ?? 100 - aiProbability, "humanProbability"),
    classification: body.classification,
    confidence: body.confidence,
    breakdown,
    sentences,
  };
}

/**
 * One document answer, held as a model. The scores it returns are the upstream's; the only
 * local arithmetic is the paragraph, which is an aggregate of its own sentences (§37 puts
 * aggregation after inference, and a paragraph is not a second opinion).
 */
export class RemoteDetectionModel implements DetectionModel {
  readonly id: string;
  readonly version: string;
  private readonly report: RemoteReport;
  private readonly byText = new Map<string, RemoteSentenceAnswer>();

  constructor(report: RemoteReport, modelId: string, version: string) {
    this.report = report;
    this.id = modelId;
    this.version = version;
    for (const sentence of report.sentences) {
      this.byText.set(sentence.text.trim(), sentence);
    }
  }

  analyzeSentence(input: SentenceInput): SentenceScore {
    const text = input.features.text.trim();
    // Matched by what the sentence says, because this service and the upstream may split
    // the same writing at slightly different points. The index is only a fallback, and only
    // when both sides counted the same number of sentences.
    const answer =
      this.byText.get(text) ??
      (this.report.sentences.length === input.documentFeatures.sentenceCount
        ? this.report.sentences[input.index]
        : undefined);
    if (!answer) {
      throw new UpstreamFailure(
        `The upstream model returned no score for sentence ${input.index + 1} ("${text.slice(0, 40)}"), ` +
          "so this run is reported as a failure rather than filled in.",
      );
    }
    const ai = Math.round(answer.aiProbability);
    const confidence = answer.confidence ?? this.report.confidence;
    return {
      aiProbability: ai,
      humanProbability: 100 - ai,
      confidence,
      signal: signalKind(ai, input.features.wordCount),
      // An upstream that does not explain its per-sentence figure is not given one here;
      // the pipeline's explanation stage reports what the writing itself measures.
      signals: [],
      flagged: ai >= DETECTION_SCORE_LINES.flag,
    };
  }

  analyzeParagraph(input: ParagraphInput): ParagraphScore {
    let weighted = 0;
    let words = 0;
    let lowest = 100;
    let highest = 0;
    for (let i = 0; i < input.sentenceScores.length; i += 1) {
      const weight = input.sentenceWordCounts[i] || 1;
      const ai = input.sentenceScores[i].aiProbability;
      weighted += ai * weight;
      words += weight;
      lowest = Math.min(lowest, ai);
      highest = Math.max(highest, ai);
    }
    const ai = words > 0 ? Math.round(weighted / words) : 50;
    return {
      aiProbability: ai,
      // Sentences that disagree about a paragraph mean the upstream cannot be read as one
      // judgement over it, so the paragraph's own confidence drops to the honest answer.
      confidence: highest - lowest <= 15 ? this.report.confidence : "low",
      signal: signalKind(ai, words),
    };
  }

  analyzeDocument(_input: DocumentInput): DocumentScore {
    // The document figures are the upstream's, verbatim; a score re-derived from the
    // sentences would be this service's opinion, not the model's. The document itself is
    // therefore not looked at here, which is why the parameter goes unused. §37's confidence
    // stage runs after this one and replaces the confidence below with what this app's own
    // measurement of the writing supports, which is why a short, disagreeing document can
    // come back as `low` beside a confident upstream score.
    return {
      aiProbability: this.report.aiProbability,
      humanProbability: this.report.humanProbability,
      confidence: this.report.confidence,
      classification: this.report.classification,
      breakdown: this.report.breakdown,
      signals: [],
    };
  }
}

/** Ask the upstream once for the whole document. Throws `UpstreamFailure` with the reason. */
export async function fetchRemoteReport(
  text: string,
  language: string | null,
  options: RemoteModelOptions,
): Promise<RemoteReport> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let response: Response;
  try {
    response = await fetch(options.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: options.modelId, language, text }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new UpstreamFailure(
      timedOut
        ? `The model at ${hostOf(options.url)} did not answer within ${options.timeoutMs} ms.`
        : `The model at ${hostOf(options.url)} could not be reached.`,
    );
  }
  if (!response.ok) {
    throw new UpstreamFailure(`The model at ${hostOf(options.url)} answered ${response.status}.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new UpstreamFailure(`The model at ${hostOf(options.url)} returned a body that is not JSON.`);
  }
  return parseRemoteReport(payload);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "the upstream model";
  }
}

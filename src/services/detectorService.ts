import type {
  AnalysisPhase,
  Classification,
  ClassificationBreakdown,
  ConfidenceLevel,
  DetectedSignal,
  DetectionResult,
  DocumentMetrics,
  LanguageCode,
  ParagraphAnalysis,
  SentenceAnalysis,
  SignalKind,
} from "@/types";
import { ApiError, apiRequest, backendConfigured } from "@/lib/api";
import { MAX_WORDS, MIN_WORDS } from "@/lib/utils";
import {
  assembleResult,
  detectLanguageStage,
  featureStage,
  inferenceStage,
  normalizeInput,
  segmentInput,
  validateInput,
} from "@/lib/detection/pipeline";
import { getDefaultModel } from "@/lib/detection/model";

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  "en", "es", "fr", "de", "pt", "it", "nl", "zh", "ja", "ko", "ru", "ar", "hi",
];

export const DETECTION_DISCLAIMER =
  "AI-detection results are probabilistic estimates, not verdicts. A score reflects only how closely a text matches patterns we have observed in machine-generated writing, and those patterns overlap heavily with careful, formal or non-native human prose. Every detector can produce false positives and false negatives: genuine human writing is sometimes flagged, and machine writing sometimes passes. No output from this tool should be treated as definitive proof of who wrote something, and none is stated as certain — treat a result as one imperfect signal to weigh alongside your own judgement.";

export interface DetectorCapabilities {
  engineId: string;
  engineVersion: string;
  runningLocally: boolean;
  minWords: number;
  maxWords: number;
  supportedLanguages: LanguageCode[];
}

export interface DetectOptions {
  language?: LanguageCode;
  signal?: AbortSignal;
  onPhase?: (phase: AnalysisPhase) => void;
}

const PHASE_PAUSE_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ApiError("timeout", "That analysis was cancelled before it finished.", "Run it again when you are ready.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError("api", `The detection service returned an invalid ${field}.`);
  }
  return value;
}

const SIGNAL_KINDS: SignalKind[] = ["human", "ai", "mixed", "neutral"];
const CONFIDENCES: ConfidenceLevel[] = ["low", "moderate", "high", "very-high"];
const CLASSIFICATIONS: Classification[] = [
  "ai_generated", "ai_generated_refined", "human_refined", "human_written",
];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ApiError("api", `The detection service returned an unknown ${field}.`);
  }
  return value as T;
}

function guardSentence(value: unknown, index: number): SentenceAnalysis {
  if (!isRecord(value)) throw new ApiError("api", `Sentence ${index} in the response was malformed.`);
  const ai = asFiniteNumber(value.aiProbability, `sentence ${index} aiProbability`);
  const signals = Array.isArray(value.signals) ? (value.signals as DetectedSignal[]) : [];
  return {
    id: typeof value.id === "string" ? value.id : `sent_remote_${index}`,
    index: asFiniteNumber(value.index ?? index, `sentence ${index} index`),
    start: asFiniteNumber(value.start, `sentence ${index} start`),
    end: asFiniteNumber(value.end, `sentence ${index} end`),
    paragraphIndex: asFiniteNumber(value.paragraphIndex ?? 0, `sentence ${index} paragraphIndex`),
    text: typeof value.text === "string" ? value.text : "",
    aiProbability: ai,
    humanProbability: typeof value.humanProbability === "number" ? value.humanProbability : 100 - ai,
    confidence: oneOf(value.confidence ?? "moderate", CONFIDENCES, `sentence ${index} confidence`),
    signal: oneOf(value.signal ?? "mixed", SIGNAL_KINDS, `sentence ${index} signal`),
    signals,
    wordCount: asFiniteNumber(value.wordCount ?? 0, `sentence ${index} wordCount`),
    characterCount: asFiniteNumber(value.characterCount ?? 0, `sentence ${index} characterCount`),
    syllableEstimate: asFiniteNumber(value.syllableEstimate ?? 0, `sentence ${index} syllableEstimate`),
    flagged: typeof value.flagged === "boolean" ? value.flagged : ai >= 60,
  };
}

function guardParagraph(value: unknown, index: number): ParagraphAnalysis {
  if (!isRecord(value)) throw new ApiError("api", `Paragraph ${index} in the response was malformed.`);
  return {
    index: asFiniteNumber(value.index ?? index, `paragraph ${index} index`),
    text: typeof value.text === "string" ? value.text : "",
    aiProbability: asFiniteNumber(value.aiProbability, `paragraph ${index} aiProbability`),
    confidence: oneOf(value.confidence ?? "moderate", CONFIDENCES, `paragraph ${index} confidence`),
    signal: oneOf(value.signal ?? "mixed", SIGNAL_KINDS, `paragraph ${index} signal`),
    sentenceIndices: Array.isArray(value.sentenceIndices) ? (value.sentenceIndices as number[]) : [],
  };
}

function guardMetrics(value: unknown): DocumentMetrics {
  if (!isRecord(value)) throw new ApiError("api", "The detection response was missing its metrics.");
  const g = (field: string) => asFiniteNumber(value[field], `metrics.${field}`);
  return {
    words: g("words"),
    characters: g("characters"),
    charactersNoSpaces: g("charactersNoSpaces"),
    sentences: g("sentences"),
    paragraphs: g("paragraphs"),
    averageSentenceLength: g("averageSentenceLength"),
    sentenceLengthStdDev: g("sentenceLengthStdDev"),
    vocabularyDiversity: g("vocabularyDiversity"),
    readabilityScore: g("readabilityScore"),
    readabilityLabel: typeof value.readabilityLabel === "string" ? value.readabilityLabel : "",
    burstiness: g("burstiness"),
    readingTimeSeconds: g("readingTimeSeconds"),
    longestSentence: g("longestSentence"),
    uniqueWords: g("uniqueWords"),
  };
}

function guardBreakdown(value: unknown): ClassificationBreakdown {
  if (!isRecord(value)) throw new ApiError("api", "The detection response was missing its classification breakdown.");
  const breakdown = {
    ai_generated: asFiniteNumber(value.ai_generated, "breakdown.ai_generated"),
    ai_generated_refined: asFiniteNumber(value.ai_generated_refined, "breakdown.ai_generated_refined"),
    human_refined: asFiniteNumber(value.human_refined, "breakdown.human_refined"),
    human_written: asFiniteNumber(value.human_written, "breakdown.human_written"),
  };
  const total = breakdown.ai_generated + breakdown.ai_generated_refined + breakdown.human_refined + breakdown.human_written;
  if (Math.round(total) !== 100) {
    throw new ApiError("api", "The detection service returned a breakdown that does not sum to 100%.");
  }
  return breakdown;
}

/** Runtime shape check on remote payloads so a malformed service response fails loudly instead of poisoning the UI. */
export function validateDetectionResult(payload: unknown): DetectionResult {
  if (!isRecord(payload)) throw new ApiError("api", "The detection service returned an unexpected response shape.");
  const ai = asFiniteNumber(payload.aiProbability, "aiProbability");
  const sentences = Array.isArray(payload.sentences) ? payload.sentences.map(guardSentence) : [];
  const paragraphs = Array.isArray(payload.paragraphs) ? payload.paragraphs.map(guardParagraph) : [];
  return {
    documentId: typeof payload.documentId === "string" ? payload.documentId : "doc_remote",
    analysisId: typeof payload.analysisId === "string" ? payload.analysisId : "an_remote",
    analyzedAt: typeof payload.analyzedAt === "string" ? payload.analyzedAt : new Date().toISOString(),
    language: oneOf(payload.language ?? "en", SUPPORTED_LANGUAGES, "language"),
    aiProbability: ai,
    humanProbability: typeof payload.humanProbability === "number" ? payload.humanProbability : 100 - ai,
    confidence: oneOf(payload.confidence, CONFIDENCES, "confidence"),
    classification: oneOf(payload.classification, CLASSIFICATIONS, "classification"),
    breakdown: guardBreakdown(payload.breakdown),
    sentences,
    paragraphs,
    metrics: guardMetrics(payload.metrics),
    signals: Array.isArray(payload.signals) ? (payload.signals as DetectedSignal[]) : [],
    engine: typeof payload.engine === "string" ? payload.engine : "remote",
    engineVersion: typeof payload.engineVersion === "string" ? payload.engineVersion : "unknown",
    processingMs: typeof payload.processingMs === "number" ? payload.processingMs : 0,
  };
}

async function detectRemotely(text: string, options: DetectOptions): Promise<DetectionResult> {
  // The same rule the local path applies, read on this side too: a passage too short to
  // measure should not become a request, and the reader should get the engine's own words
  // about why rather than a status code.
  validateInput(text);
  throwIfAborted(options.signal);
  const payload = await apiRequest<unknown>("/api/detect", {
    method: "POST",
    body: { text, language: options.language },
    signal: options.signal,
  });
  return validateDetectionResult(payload);
}

async function detectLocally(text: string, options: DetectOptions): Promise<DetectionResult> {
  const model = getDefaultModel();
  const startedAt = Date.now();
  const { language, signal, onPhase } = options;

  throwIfAborted(signal);
  onPhase?.("preparing");
  await sleep(PHASE_PAUSE_MS);
  validateInput(text);

  throwIfAborted(signal);
  onPhase?.("normalizing");
  await sleep(PHASE_PAUSE_MS);
  const normalized = normalizeInput(text);
  const resolvedLanguage = detectLanguageStage(normalized, language);

  throwIfAborted(signal);
  onPhase?.("analyzing");
  await sleep(PHASE_PAUSE_MS);
  const segmentation = segmentInput(normalized);
  const features = featureStage(normalized);

  throwIfAborted(signal);
  onPhase?.("scoring");
  await sleep(PHASE_PAUSE_MS);
  const scores = inferenceStage(model, features, normalized);

  throwIfAborted(signal);
  onPhase?.("reporting");
  await sleep(PHASE_PAUSE_MS);
  return assembleResult({
    model,
    normalized,
    language: resolvedLanguage,
    features,
    segmentation,
    scores,
    startedAt,
  });
}

export async function detectText(text: string, options: DetectOptions = {}): Promise<DetectionResult> {
  return backendConfigured() ? detectRemotely(text, options) : detectLocally(text, options);
}

export function getDetectorCapabilities(): DetectorCapabilities {
  const model = getDefaultModel();
  return {
    engineId: model.id,
    engineVersion: model.version,
    runningLocally: !backendConfigured(),
    minWords: MIN_WORDS,
    maxWords: MAX_WORDS,
    supportedLanguages: [...SUPPORTED_LANGUAGES],
  };
}

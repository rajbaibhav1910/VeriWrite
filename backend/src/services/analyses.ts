/**
 * Saving an analysis: one run becomes a history row plus the text it measured.
 *
 * A saved analysis is two rows written together — `history` for the list and `analyses`
 * for the measurement — because the History page has to render without decoding a blob,
 * and reopening a row has to show the same text the scores were made from. When a row is
 * left pointing at nothing, `result_present` goes false rather than the figures being
 * invented again, which is the same honesty rule the browser's own store follows.
 */
import type { SentenceAnalysisRow } from "../models/index.ts";
import { store } from "../store/memory.ts";
import {
  BadRequest,
  type AnalysisWire,
  countWords,
  documentToWire,
  historyToWire,
  languageOr,
  type NewAnalysisInput,
  NotFound,
  titleFromText,
} from "../schemas/wire.ts";
import { recordRunUsage } from "./usage.ts";

/** The four-band table `src/lib/detection/model.ts` uses for sentence scores, restated for
 * this index: 72/52/32 on the app's 0-100 scale. The measurement itself is stored verbatim
 * in `analyses.result`, so a band here only names where a sentence sits for filtering. */
const BANDS: Array<{ classification: SentenceAnalysisRow["classification"]; min: number }> = [
  { classification: "ai_generated", min: 72 },
  { classification: "ai_generated_refined", min: 52 },
  { classification: "human_refined", min: 32 },
  { classification: "human_written", min: 0 },
];

function bandFor(aiProbability: number): SentenceAnalysisRow["classification"] {
  for (const band of BANDS) if (aiProbability >= band.min) return band.classification;
  return "human_written";
}

function isoOr(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? fallback : at.toISOString();
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Only a sentence this table can hold becomes a row: a run whose sentence list is not
 * shaped is still stored whole in `analyses.result`, and the index simply has fewer
 * entries in it. Refusing the save over a half-shaped blob would lose a measurement the
 * user made; inventing offsets would store a fact that was never measured.
 */
function sentenceRows(
  result: Record<string, unknown>,
): Omit<SentenceAnalysisRow, "id" | "analysis_id">[] {
  const out: Omit<SentenceAnalysisRow, "id" | "analysis_id">[] = [];
  if (!Array.isArray(result.sentences)) return out;
  for (const raw of result.sentences) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text : null;
    const start = numberOr(row.start, -1);
    const end = numberOr(row.end, -1);
    const probability = numberOr(row.aiProbability, -1);
    const confidence = row.confidence;
    if (
      text === null ||
      start < 0 ||
      end <= start ||
      probability < 0 ||
      typeof confidence !== "string" ||
      !["low", "moderate", "high", "very-high"].includes(confidence)
    ) {
      continue;
    }
    out.push({
      ordinal: numberOr(row.index, out.length),
      text,
      start_offset: start,
      end_offset: end,
      ai_probability: probability,
      classification: bandFor(probability),
      confidence: confidence as SentenceAnalysisRow["confidence"],
      signals: Array.isArray(row.signals) ? row.signals : [],
      metrics: { wordCount: numberOr(row.wordCount, countWords(text)) },
    });
  }
  return out;
}

/**
 * Store one finished run. Mirrors `saveAnalysis()` in the browser: an open document is
 * updated in place rather than duplicated, and a pasted text gets a document of its own
 * so the row can be reopened later with the words it was made from.
 */
export function saveAnalysis(userId: string, input: NewAnalysisInput): AnalysisWire {
  const result = input.result;
  const language = languageOr(result.language);
  const words = numberOr(
    (result.metrics as Record<string, unknown>)?.words,
    countWords(input.text),
  );

  const existing = input.documentId === null ? null : store.getDocument(userId, input.documentId);
  if (input.documentId !== null && !existing) {
    throw new BadRequest(
      `documentId "${input.documentId}" does not name a document in this library.`,
    );
  }
  const document = existing
    ? store.patchDocument(userId, existing.id, {
        body: input.text,
        // An empty title means "keep what it is called", not "call it nothing".
        title: input.title || existing.title,
        language,
        status: "completed",
      })
    : store.addDocument({
        user_id: userId,
        title: input.title || titleFromText(input.text),
        body: input.text,
        tool: input.tool,
        language,
        status: "completed",
        folder_id: null,
      });
  if (!document) throw new NotFound("The document this analysis belongs to disappeared mid-write.");

  const analysis = store.addAnalysis(
    {
      document_id: document.id,
      user_id: userId,
      tool: input.tool,
      status: "completed",
      language,
      ai_probability: input.aiProbability,
      classification: input.classification,
      confidence: input.confidence,
      word_count: words,
      // Which model said this, and which version of it. A score with no provenance names
      // the absence instead of inventing an engine.
      model_id: typeof result.engine === "string" && result.engine ? result.engine : "unknown",
      model_version:
        typeof result.engineVersion === "string" && result.engineVersion
          ? result.engineVersion
          : "unknown",
      result,
      error_code: null,
      analyzed_at: isoOr(result.analyzedAt, new Date().toISOString()),
    },
    sentenceRows(result),
  );

  const entry = store.addHistory({
    user_id: userId,
    document_id: document.id,
    analysis_id: analysis.id,
    tool: input.tool,
    title: document.title,
    status: "completed",
    ai_probability: input.aiProbability,
    classification: input.classification,
    confidence: input.confidence,
    word_count: words,
    result_present: true,
    analyzed_at: analysis.analyzed_at,
  });

  recordRunUsage(userId, input.tool, words);
  return { entry: historyToWire(entry, analysis), document: documentToWire(document) };
}

/** One row and the text it measured, or 404 for the row. A missing text is `document: null`. */
export function getAnalysisRecord(userId: string, entryId: string): AnalysisWire {
  const entry = store.getHistoryEntry(userId, entryId);
  if (!entry) throw new NotFound(`No saved analysis with id "${entryId}" is in this library.`);
  const document = entry.document_id ? store.getDocument(userId, entry.document_id) : null;
  return {
    entry: historyToWire(entry, store.analysisFor(entry)),
    document: document ? documentToWire(document) : null,
  };
}

/**
 * A second copy of a row and its text. Nothing is re-measured: the copy keeps the
 * original's timestamp, its figures and its model, because duplicating a record is not a
 * new run. Without the text there is nothing to copy, which answers 404 — the same fact
 * the local store returns as `null`.
 */
export function duplicateAnalysisRecord(userId: string, entryId: string): AnalysisWire {
  const source = store.getHistoryEntry(userId, entryId);
  if (!source) throw new NotFound(`No saved analysis with id "${entryId}" is in this library.`);
  const original = source.document_id ? store.getDocument(userId, source.document_id) : null;
  if (!original) {
    throw new NotFound(`The text behind analysis "${entryId}" is no longer in this library.`);
  }
  const copy = store.addDocument({
    user_id: userId,
    title: `${original.title} (copy)`,
    body: original.body,
    tool: original.tool,
    language: original.language,
    status: original.status,
    folder_id: original.folder_id,
  });
  const entry = store.addHistory({
    user_id: userId,
    document_id: copy.id,
    analysis_id: source.analysis_id,
    tool: source.tool,
    title: copy.title,
    status: source.status,
    ai_probability: source.ai_probability,
    classification: source.classification,
    confidence: source.confidence,
    word_count: source.word_count,
    // The shared measurement is only as reachable as the analysis row that holds it.
    result_present: store.analysisFor(source) !== null,
    analyzed_at: source.analyzed_at,
  });
  return { entry: historyToWire(entry, store.analysisFor(entry)), document: documentToWire(copy) };
}

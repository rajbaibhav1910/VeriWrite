import type { AnalysisPhase, SummaryResult } from "@/types";
import { apiRequest, backendConfigured } from "@/lib/api";
import { countWords, splitSentences } from "@/lib/text";
import { formatNumber } from "@/lib/utils";
import {
  PHASE_PAUSE_MS,
  assertTextLength,
  requireRecord,
  requireString,
  sleep,
  throwIfAborted,
} from "@/lib/service";
import {
  SUMMARY_LENGTH_CHOICES,
  extractKeywords,
  summarize as runSummarizerEngine,
} from "@/lib/tools/summarizerEngine";

export { SUMMARY_LENGTH_CHOICES, extractKeywords };

export type SummaryFormat = SummaryResult["format"];

/** Below this a document has too little structure to rank sentences in. */
export const SUMMARY_MIN_WORDS = 20;

/**
 * What this tool is, stated in the terms the result can support: it selects, it
 * does not write. Every summary sentence comes out of the input unchanged.
 */
export const SUMMARIZER_NOTE =
  "This is an extractive summarizer: it scores the sentences you gave it and copies the best-ranked ones out unchanged, so nothing in the summary is wording the document never had. It cannot add a conclusion, fill in context, or tell a passage that is merely prominent from one that matters. Read the summary against the original before relying on it.";

export const SUMMARY_FORMATS: { id: SummaryFormat; label: string; note: string }[] = [
  { id: "paragraph", label: "Paragraph", note: "Flowing prose made of the highest-scoring sentences." },
  { id: "bullets", label: "Bullet summary", note: "One line per kept sentence." },
  { id: "key-points", label: "Key points", note: "Short claims, without connective text." },
];

export interface SummarizerRunOptions {
  length?: number;
  format?: SummaryFormat;
  signal?: AbortSignal;
  onPhase?: (phase: AnalysisPhase) => void;
}

function guardSummary(payload: unknown): SummaryResult {
  const record = requireRecord(payload, "summarizer");
  const format = SUMMARY_FORMATS.some((entry) => entry.id === record.format)
    ? (record.format as SummaryFormat)
    : "paragraph";
  return {
    summary: requireString(record, "summary", "summarizer"),
    keyPoints: Array.isArray(record.keyPoints)
      ? record.keyPoints.filter((point): point is string => typeof point === "string")
      : [],
    keywords: Array.isArray(record.keywords)
      ? record.keywords.filter((word): word is string => typeof word === "string")
      : [],
    format,
    compressionRatio:
      typeof record.compressionRatio === "number" ? record.compressionRatio : 0,
  };
}

async function summarizeRemotely(
  text: string,
  options: SummarizerRunOptions,
): Promise<SummaryResult> {
  const payload = await apiRequest<unknown>("/api/summarize", {
    method: "POST",
    body: { text, length: options.length, format: options.format },
    signal: options.signal,
  });
  return guardSummary(payload);
}

async function summarizeLocally(
  text: string,
  options: SummarizerRunOptions,
): Promise<SummaryResult> {
  const { signal, onPhase, length, format = "paragraph" } = options;
  throwIfAborted(signal, "That summary");
  onPhase?.("preparing");
  assertTextLength(text, "The summarizer", SUMMARY_MIN_WORDS);
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That summary");
  onPhase?.("analyzing");
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That summary");
  onPhase?.("scoring");
  const result = runSummarizerEngine(text, {
    length: length ?? defaultLength(text),
    format,
  });

  onPhase?.("reporting");
  await sleep(PHASE_PAUSE_MS / 2);
  return result;
}

/** Scales the sentence budget with the size of the input. */
export function defaultLength(text: string): number {
  const sentences = Math.max(1, (text.match(/[.!?]+(?:\s|$)/gu) ?? []).length);
  return Math.min(8, Math.max(2, Math.round(sentences * 0.25)));
}

/**
 * One line saying what a run did, measured from the two texts rather than from a
 * claim about quality. Used by the toast and the result card so they cannot drift.
 */
export function describeSummaryRun(result: SummaryResult, sourceText: string): string {
  const sourceWords = countWords(sourceText);
  const summaryWords = countWords(result.summary);
  const share = sourceWords === 0 ? 0 : Math.round((summaryWords / sourceWords) * 100);
  const sentences = splitSentences(result.summary).length;
  return `${formatNumber(summaryWords)} words in ${formatNumber(sentences)} sentence${sentences === 1 ? "" : "s"} kept out of ${formatNumber(sourceWords)} — about ${share}% of the text, copied from it verbatim.`;
}

/**
 * The run's three outputs as one plain-text block, for copying and for the .txt
 * download, so a reader gets the same words the screen shows.
 */
export function summaryAsText(result: SummaryResult): string {
  const lines = [
    "SUMMARY",
    result.summary,
    "",
    "KEY FINDINGS",
    ...(result.keyPoints.length > 0
      ? result.keyPoints.map((point, index) => `${index + 1}. ${point}`)
      : ["(none)"]),
    "",
    "KEYWORDS",
    result.keywords.length > 0 ? result.keywords.join(", ") : "(none)",
  ];
  return lines.join("\n");
}

/** Where the summariser runs and what it covers, so a badge cannot overstate it. */
export function getSummarizerStatus() {
  return backendConfigured()
    ? {
        engine: "backend" as const,
        scope: "Summaries come from the text service this app is connected to.",
      }
    : {
        engine: "local" as const,
        scope:
          "Ranking and copying happen in this browser. The text is not sent anywhere.",
      };
}

export async function summarizeText(
  text: string,
  options: SummarizerRunOptions = {},
): Promise<SummaryResult> {
  return backendConfigured() ? summarizeRemotely(text, options) : summarizeLocally(text, options);
}

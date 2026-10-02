import type { AnalysisPhase, PlagiarismResult, PlagiarismSource } from "@/types";
import { apiRequest, backendConfigured } from "@/lib/api";
import {
  PHASE_PAUSE_MS,
  assertTextLength,
  requireRecord,
  sleep,
  throwIfAborted,
} from "@/lib/service";
import {
  PLAGIARISM_CORPUS_SIZE,
  PLAGIARISM_SCOPE,
  plagiarismSpans,
  scanPlagiarism,
} from "@/lib/tools/plagiarismEngine";
import type { PlagiarismMatch, PlagiarismOptions, PlagiarismScan } from "@/lib/tools/plagiarismEngine";

export { PLAGIARISM_CORPUS_SIZE, PLAGIARISM_SCOPE, plagiarismSpans };
export type { PlagiarismMatch, PlagiarismOptions, PlagiarismScan };

/** Below this the overlap figures are noise, so the scan is refused rather than run. */
export const PLAGIARISM_MIN_WORDS = 15;

/**
 * One shape for both paths so the page cannot render a backend result as if it
 * carried local evidence, or hide which path produced the figures.
 */
export interface PlagiarismRun extends PlagiarismResult {
  matches: PlagiarismMatch[];
  wordsScanned: number;
  /** How many documents were compared. Zero means the service did not say. */
  corpusSize: number;
  notice: string;
  engine: "demo-corpus" | "backend";
}

export interface PlagiarismRunOptions extends PlagiarismOptions {
  signal?: AbortSignal;
  onPhase?: (phase: AnalysisPhase) => void;
}

/** Says what a remote scan covered without claiming anything about its quality. */
const REMOTE_NOTICE =
  "These figures came from the similarity service this app is connected to. What that service searches is its own configuration: a clean result here means no match in the index it queried, not proof of authorship.";

const MATCH_KINDS = ["verbatim", "near-paraphrase"] as const;

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A remote source card is only shown as far as its fields check out. */
function guardRemoteSource(value: unknown, index: number): PlagiarismSource {
  const record = requireRecord(value, "plagiarism");
  const title = typeof record.title === "string" ? record.title : "";
  return {
    id: typeof record.id === "string" ? record.id : `source_remote_${index}`,
    title: title || "Untitled source",
    url: typeof record.url === "string" ? record.url : "",
    snippet: typeof record.snippet === "string" ? record.snippet : "",
    similarity: positiveNumber(record.similarity) ?? 0,
    matchedText: typeof record.matchedText === "string" ? record.matchedText : "",
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : undefined,
  };
}

function guardRemoteMatch(value: unknown, index: number): PlagiarismMatch {
  const record = requireRecord(value, "plagiarism");
  const matchedText = typeof record.matchedText === "string" ? record.matchedText : "";
  return {
    id: typeof record.id === "string" ? record.id : `match_remote_${index}`,
    sourceId: typeof record.sourceId === "string" ? record.sourceId : `source_remote_${index}`,
    sourceTitle: typeof record.sourceTitle === "string" ? record.sourceTitle : "Untitled source",
    url: typeof record.url === "string" ? record.url : "",
    kind: MATCH_KINDS.includes(record.kind as (typeof MATCH_KINDS)[number])
      ? (record.kind as PlagiarismMatch["kind"])
      : "near-paraphrase",
    start: positiveNumber(record.start) ?? 0,
    end: positiveNumber(record.end) ?? 0,
    matchedText,
    sourceText: typeof record.sourceText === "string" ? record.sourceText : "",
    similarity: positiveNumber(record.similarity) ?? 0,
    words: positiveNumber(record.words) ?? 0,
  };
}

function guardRemoteScan(payload: unknown): PlagiarismRun {
  const record = requireRecord(payload, "plagiarism");
  const originality = positiveNumber(record.originality) ?? 0;
  const matchedPercentage = positiveNumber(record.matchedPercentage) ?? 100 - originality;
  return {
    documentId: typeof record.documentId === "string" ? record.documentId : "doc_remote",
    originality,
    matchedPercentage,
    sources: Array.isArray(record.sources)
      ? record.sources.map((source, index) => guardRemoteSource(source, index))
      : [],
    scannedAt: typeof record.scannedAt === "string" ? record.scannedAt : new Date().toISOString(),
    // Only the response itself can claim a real index; nothing here upgrades `demo`.
    demo: record.demo !== false,
    matches: Array.isArray(record.matches)
      ? record.matches.map((match, index) => guardRemoteMatch(match, index))
      : [],
    wordsScanned: positiveNumber(record.wordsScanned) ?? 0,
    corpusSize: positiveNumber(record.corpusSize) ?? 0,
    notice:
      typeof record.notice === "string" && record.notice.trim().length > 0
        ? record.notice
        : REMOTE_NOTICE,
    engine: "backend",
  };
}

async function plagiarismRemotely(
  text: string,
  options: PlagiarismRunOptions,
): Promise<PlagiarismRun> {
  const payload = await apiRequest<unknown>("/api/plagiarism", {
    method: "POST",
    body: { text, minRun: options.minRun, minSharedWords: options.minSharedWords },
    signal: options.signal,
  });
  return guardRemoteScan(payload);
}

async function plagiarismLocally(
  text: string,
  options: PlagiarismRunOptions,
): Promise<PlagiarismRun> {
  const { signal, onPhase } = options;
  throwIfAborted(signal, "That scan");
  onPhase?.("preparing");
  assertTextLength(text, "The plagiarism checker", PLAGIARISM_MIN_WORDS);
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That scan");
  onPhase?.("analyzing");
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That scan");
  onPhase?.("scoring");
  const scan: PlagiarismScan = scanPlagiarism(text, undefined, options);

  throwIfAborted(signal, "That scan");
  onPhase?.("reporting");
  await sleep(PHASE_PAUSE_MS / 2);
  return { ...scan, engine: "demo-corpus" };
}

/**
 * Runs a source comparison. Without a backend this is a bundled-corpus check, and the
 * returned `demo` flag, `engine` and `notice` all say so — the UI renders them instead
 * of restating what a scan means.
 */
export async function scanForMatches(
  text: string,
  options: PlagiarismRunOptions = {},
): Promise<PlagiarismRun> {
  return backendConfigured() ? plagiarismRemotely(text, options) : plagiarismLocally(text, options);
}

export function getPlagiarismStatus() {
  return backendConfigured()
    ? {
        engine: "backend" as const,
        scope: "Reported by the connected similarity index.",
        corpusSize: 0,
      }
    : {
        engine: "demo-corpus" as const,
        scope: PLAGIARISM_SCOPE,
        corpusSize: PLAGIARISM_CORPUS_SIZE,
      };
}

/**
 * The wire contract, in one file, so the shape the frontend parses is written down
 * somewhere other than in the frontend.
 *
 * `src/services/documentService.ts` on the client reads exactly these fields and
 * refuses a row that does not carry them — an unknown `tool`, a missing `id`, a
 * `result` with no sentences. This module is the producer side of that same rule:
 * a row that cannot be rendered by the client is not sent to it either.
 *
 * Names are camelCase on the wire because the client's parsers are camelCase; the
 * database stays snake_case (see `src/models/index.ts`).
 */
import type {
  AnalysisRow,
  DocumentRow,
  FolderRow,
  HistoryRow,
  UsageCounterRow,
  UsageDayRow,
} from "../models/index.ts";

export interface DocumentWire {
  id: string;
  title: string;
  text: string;
  tool: DocumentRow["tool"];
  language: string;
  status: DocumentRow["status"];
  folderId: string | null;
  favorite: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export function documentToWire(row: DocumentRow): DocumentWire {
  return {
    id: row.id,
    title: row.title,
    // The client calls this field `text`; the table calls it `body`.
    text: row.body,
    tool: row.tool,
    language: row.language,
    status: row.status,
    folderId: row.folder_id,
    favorite: row.favorite,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FolderWire {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export function folderToWire(row: FolderRow): FolderWire {
  return { id: row.id, name: row.name, parentId: row.parent_id, createdAt: row.created_at };
}

/**
 * A history row carries its measurement only while the measurement still exists. The
 * client renders such a row as a summary with no report and no reopen — sending a
 * half-decoded blob would let it look like a figure it is not.
 */
export interface HistoryWire {
  id: string;
  documentId: string | null;
  title: string;
  tool: HistoryRow["tool"];
  status: HistoryRow["status"];
  classification: HistoryRow["classification"];
  confidence: HistoryRow["confidence"];
  analyzedAt: string;
  aiProbability: number;
  wordCount: number;
  result?: unknown;
}

export function historyToWire(row: HistoryRow, analysis: AnalysisRow | null): HistoryWire {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    tool: row.tool,
    status: row.status,
    classification: row.classification,
    confidence: row.confidence,
    analyzedAt: row.analyzed_at,
    aiProbability: row.ai_probability,
    wordCount: row.word_count,
    result: row.result_present ? (analysis?.result ?? undefined) : undefined,
  };
}

export interface AnalysisWire {
  entry: HistoryWire;
  document: DocumentWire | null;
}

/* ------------------------------------------------------------------ incoming */

export class BadRequest extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "BadRequest";
  }
}

/**
 * A row this user does not have. The client's `loadDocument` and `loadAnalysisRecord`
 * read 404 as "not there" and every other failure as "the call did not work", so the
 * two must not be confused — answering a missing row with an empty body would make a
 * deleted document look like a broken service.
 */
export class NotFound extends Error {
  readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFound";
  }
}

/** Detection is switched off on this service. The answer names the reason, never a score. */
export class DetectionDisabled extends Error {
  readonly status = 501;
  constructor(message: string) {
    super(message);
    this.name = "DetectionDisabled";
  }
}

/**
 * A model this service asked failed to answer, or answered with something that cannot
 * become a measurement. 502 rather than 200: the client must not be handed a figure the
 * upstream did not give.
 */
export class UpstreamFailure extends Error {
  readonly status = 502;
  constructor(message: string) {
    super(message);
    this.name = "UpstreamFailure";
  }
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequest(`${what} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new BadRequest(`${field} must be a string.`);
  if (value.length > maxLength) throw new BadRequest(`${field} is longer than ${maxLength} characters.`);
  return value;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return asString(value, field, maxLength);
}

const TOOLS = new Set([
  "detector",
  "paraphraser",
  "humanizer",
  "grammar",
  "plagiarism",
  "summarizer",
  "translator",
  "citations",
  "writer",
]);

const CLASSIFICATIONS = new Set([
  "ai_generated",
  "ai_generated_refined",
  "human_refined",
  "human_written",
]);

const CONFIDENCES = new Set(["low", "moderate", "high", "very-high"]);

/** The four classes and the four confidence words, named once so two checkers cannot drift. */
export function isClassification(value: unknown): value is HistoryRow["classification"] {
  return typeof value === "string" && CLASSIFICATIONS.has(value);
}

export function isConfidence(value: unknown): value is HistoryRow["confidence"] {
  return typeof value === "string" && CONFIDENCES.has(value);
}

/**
 * The language codes the app renders a name for. A document stored under any other code
 * is a row the client's own parser refuses and counts as unreadable, so it is refused
 * here instead — the safer direction, and the one that keeps the two lists honest.
 */
const LANGUAGES = new Set([
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "nl",
  "zh",
  "ja",
  "ko",
  "ru",
  "ar",
  "hi",
]);

function languageOf(value: unknown): string {
  const language = asString(value ?? "en", "language", 8);
  if (!LANGUAGES.has(language)) {
    throw new BadRequest(`language "${language}" is not one the app lists a name for.`);
  }
  return language;
}

/**
 * The same list, read leniently: an analysis carries the language its engine detected,
 * and a code this app has no name for is stored as English rather than refused — the
 * measurement is the part that matters, and the client labels a row `en` either way.
 */
export function languageOr(value: unknown, fallback = "en"): string {
  return typeof value === "string" && LANGUAGES.has(value) ? value : fallback;
}

export interface NewDocumentInput {
  title: string;
  text: string;
  tool: DocumentRow["tool"];
  language: string;
  folderId: string | null;
  status: DocumentRow["status"];
}

/** The body `PUT/POST /api/documents` sends, checked against the same limits the UI uses. */
export function parseDocumentBody(raw: unknown): NewDocumentInput {
  const body = asRecord(raw, "The document body");
  const text = asString(body.text ?? "", "text", 200_000);
  const title = asString(body.title ?? "", "title", 120).trim();
  const tool = asString(body.tool ?? "detector", "tool", 32);
  if (!TOOLS.has(tool)) throw new BadRequest(`tool "${tool}" is not a tool this app has.`);
  const status = asString(body.status ?? "draft", "status", 16);
  if (!["draft", "processing", "completed", "failed"].includes(status)) {
    throw new BadRequest(`status "${status}" is not one the app knows.`);
  }
  return {
    title: title.length > 0 ? title : titleFromText(text),
    text,
    tool: tool as DocumentRow["tool"],
    language: languageOf(body.language),
    folderId: optionalString(body.folderId, "folderId", 64),
    status: status as DocumentRow["status"],
  };
}

export interface DocumentPatch extends Partial<NewDocumentInput> {
  favorite?: boolean;
}

/** The fields a PATCH may carry; anything else in the body is ignored, not applied. */
export function parseDocumentPatch(raw: unknown): DocumentPatch {
  const body = asRecord(raw, "The document patch");
  const patch: DocumentPatch = {};
  if (body.title !== undefined) {
    const title = asString(body.title, "title", 120).trim();
    if (!title) throw new BadRequest("title must not be empty.");
    patch.title = title;
  }
  if (body.text !== undefined) patch.text = asString(body.text, "text", 200_000);
  if (body.folderId !== undefined) {
    patch.folderId = body.folderId === null ? null : asString(body.folderId, "folderId", 64);
  }
  if (body.favorite !== undefined) {
    if (typeof body.favorite !== "boolean") throw new BadRequest("favorite must be true or false.");
    patch.favorite = body.favorite;
  }
  if (body.status !== undefined) {
    const status = asString(body.status, "status", 16);
    if (!["draft", "processing", "completed", "failed"].includes(status)) {
      throw new BadRequest(`status "${status}" is not one the app knows.`);
    }
    patch.status = status as DocumentRow["status"];
  }
  if (body.language !== undefined) patch.language = languageOf(body.language);
  return patch;
}

export interface NewAnalysisInput {
  text: string;
  title: string | null;
  documentId: string | null;
  tool: DocumentRow["tool"];
  /** The engine's whole measurement, stored as it arrived. */
  result: Record<string, unknown>;
  /* The four figures the row is indexed by, already checked against the client's own union. */
  classification: HistoryRow["classification"];
  confidence: HistoryRow["confidence"];
  aiProbability: number;
}

/**
 * The body `POST /api/analyses` sends. The measurement is checked for the fields the
 * client's own validator insists on, so a run stored here can always be read back
 * there — a row whose figures the client would refuse is a row that should not exist.
 */
export function parseAnalysisBody(raw: unknown): NewAnalysisInput {
  const body = asRecord(raw, "The analysis body");
  const text = asString(body.text, "text", 200_000);
  if (text.trim().length === 0) throw new BadRequest("An analysis needs the text it measured.");
  const tool = asString(body.tool ?? "detector", "tool", 32);
  if (!TOOLS.has(tool)) throw new BadRequest(`tool "${tool}" is not a tool this app has.`);
  const result = asRecord(body.result, "result");
  const classification = String(result.classification);
  if (!CLASSIFICATIONS.has(classification)) {
    throw new BadRequest("result.classification is not one of the four the app reports.");
  }
  const confidence = String(result.confidence);
  if (!CONFIDENCES.has(confidence)) {
    throw new BadRequest("result.confidence is not one the app reports.");
  }
  const aiProbability = result.aiProbability;
  if (
    typeof aiProbability !== "number" ||
    !Number.isFinite(aiProbability) ||
    aiProbability < 0 ||
    aiProbability > 100
  ) {
    // The app's own scale: the engine's band edges are 72/52/32 and the UI prints "72%".
    throw new BadRequest("result.aiProbability must be a number between 0 and 100.");
  }
  if (!Array.isArray(result.sentences)) throw new BadRequest("result.sentences must be a list.");
  if (typeof result.metrics !== "object" || result.metrics === null) {
    throw new BadRequest("result.metrics is missing.");
  }
  return {
    text,
    title: body.title === undefined || body.title === null ? null : asString(body.title, "title", 120).trim() || null,
    documentId: optionalString(body.documentId, "documentId", 64),
    tool: tool as DocumentRow["tool"],
    result,
    classification: classification as HistoryRow["classification"],
    confidence: confidence as HistoryRow["confidence"],
    aiProbability,
  };
}

export interface DetectInput {
  text: string;
  /** `null` means the engine's own language stage decides, which is what "Auto" asks for. */
  language: string | null;
}

/** The body `POST /api/detect` sends. The word limits are the engine's, checked in the service. */
export function parseDetectBody(raw: unknown): DetectInput {
  const body = asRecord(raw, "The detection body");
  const text = asString(body.text, "text", 200_000);
  if (text.trim().length === 0) throw new BadRequest("Detection needs the text to read.");
  const language = body.language;
  if (language === undefined || language === null || language === "" || language === "auto") {
    return { text, language: null };
  }
  return { text, language: languageOf(language) };
}

export interface HistoryQuery {
  query: string | null;
  tool: string | null;
  classification: string | null;
  confidence: string | null;
  from: string | null;
  to: string | null;
  sort: string;
  page: number;
  pageSize: number;
}

const SORTS = new Set(["newest", "oldest", "highest-ai", "lowest-ai", "longest"]);

/** The filters the History page sends as query parameters; `all` never reaches the wire. */
export function parseHistoryQuery(search: URLSearchParams): HistoryQuery {
  const page = Number(search.get("page") ?? "1");
  const pageSize = Number(search.get("pageSize") ?? "12");
  if (!Number.isInteger(page) || page < 1) throw new BadRequest("page must be a positive integer.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new BadRequest("pageSize must be between 1 and 200.");
  }
  const sort = search.get("sort") ?? "newest";
  if (!SORTS.has(sort)) throw new BadRequest(`sort "${sort}" is not one the app offers.`);
  const tool = search.get("tool");
  if (tool !== null && !TOOLS.has(tool)) {
    throw new BadRequest(`tool "${tool}" is not a tool this app has.`);
  }
  for (const key of ["classification", "confidence"] as const) {
    const value = search.get(key);
    if (value === null) continue;
    const table = key === "classification" ? CLASSIFICATIONS : CONFIDENCES;
    if (!table.has(value)) throw new BadRequest(`${key} "${value}" is not a value the app reports.`);
  }
  const from = search.get("from");
  const to = search.get("to");
  for (const [key, value] of [
    ["from", from],
    ["to", to],
  ] as const) {
    if (value === null) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new BadRequest(`${key} must be an ISO date.`);
  }
  return {
    query: search.get("query")?.trim() || null,
    tool,
    classification: search.get("classification"),
    confidence: search.get("confidence"),
    from,
    to,
    sort,
    page,
    pageSize,
  };
}

export interface UsageWire {
  period: string;
  resetsAt: string;
  counters: { words: number; analyses: number; rewrites: number; plagiarism: number; documents: number };
  days: Array<{ day: string; words: number; analyses: number; rewrites: number; plagiarism: number }>;
}

export function usageToWire(
  counter: UsageCounterRow | null,
  days: UsageDayRow[],
  period: string,
  resetsAt: string,
): UsageWire {
  return {
    period,
    resetsAt,
    counters: {
      words: counter?.words ?? 0,
      analyses: counter?.analyses ?? 0,
      rewrites: counter?.rewrites ?? 0,
      plagiarism: counter?.plagiarism ?? 0,
      documents: counter?.documents ?? 0,
    },
    // Only days that recorded something are listed — the client draws a gap for the rest.
    days: days.map((day) => ({
      day: day.day,
      words: day.words,
      analyses: day.analyses,
      rewrites: day.rewrites,
      plagiarism: day.plagiarism,
    })),
  };
}

/**
 * The first line of the text, cut to 48 characters — the client's `titleFromText`
 * reimplemented rather than imported, since the browser bundle and this server are
 * separate builds. If the two ever disagree the client recomputes the title anyway, so
 * a mismatch is cosmetic; keeping the rule written down is what makes that true.
 */
export function titleFromText(text: string, fallback = "Untitled document"): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n{3,} */g, "\n\n")
    .trim();
  const firstLine = (normalized.split("\n")[0] ?? "").trim();
  if (!firstLine) return fallback;
  const clean = firstLine.replace(/\s+/g, " ").trim();
  return clean.length <= 48 ? clean : `${clean.slice(0, 47)}…`;
}

/**
 * The client's word rule: a word is a run of letters or digits that may contain
 * apostrophes, hyphens, underscores and primes. The service recounts on every write so
 * a list can be sorted and filtered without reading bodies, exactly as the UI does when
 * a row arrives without a count.
 */
export function countWords(text: string): number {
  const pattern = /[\p{L}\p{N}][\p{L}\p{N}'’\-_]*/gu;
  let count = 0;
  while (pattern.exec(text) !== null) count += 1;
  return count;
}

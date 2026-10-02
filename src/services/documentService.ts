import type {
  AnalysisStatus,
  Classification,
  ConfidenceLevel,
  DetectionResult,
  Folder,
  HistoryEntry,
  LanguageCode,
  StoredDocument,
  ToolId,
} from "@/types";
import { ApiError, apiRequest, backendConfigured } from "@/lib/api";
import { optionalNumber, requireRecord } from "@/lib/service";
import { LANGUAGE_NAMES } from "@/config/languages";
import { CLASSIFICATION_LABEL, CONFIDENCE_LABEL } from "@/lib/utils";
import { STORAGE_KEYS, readJson, remove, writeJson } from "@/lib/storage";
import { countWords, titleFromText } from "@/lib/text";
import { DETECTION_DISCLAIMER_SHORT, uid } from "@/lib/utils";
import { usePreferencesStore } from "@/store/preferencesStore";

export type HistorySort =
  | "newest"
  | "oldest"
  | "highest-ai"
  | "lowest-ai"
  | "longest";

export interface HistoryFilter {
  query?: string;
  tool?: ToolId | "all";
  classification?: Classification | "all";
  confidence?: ConfidenceLevel | "all";
  /** Inclusive ISO date bounds. */
  from?: string;
  to?: string;
  sort?: HistorySort;
  page?: number;
  pageSize?: number;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * When the user turns storage off the collections still work for the session —
 * nothing is written to the device, and `persisting` reports which mode is active.
 */
let memoryDocuments: StoredDocument[] | null = null;
let memoryFolders: Folder[] | null = null;
let memoryHistory: HistoryEntry[] | null = null;

function storingAllowed(): boolean {
  return usePreferencesStore.getState().privacy.storeDocuments;
}

export function isPersisting(): boolean {
  return storingAllowed();
}

function readCollection<T>(key: string, memory: T[] | null): T[] {
  if (memory) return memory;
  return readJson<T[]>(key, []);
}

function writeCollection<T>(
  key: string,
  value: T[],
  assign: (next: T[]) => void,
): boolean {
  if (!storingAllowed()) {
    assign(value);
    return false;
  }
  const written = writeJson(key, value);
  if (!written) assign(value);
  return written;
}

/* ------------------------------------------------------------------ documents */

export interface DocumentListOptions {
  /** `null` means the unfiled list; leave undefined for every folder. */
  folderId?: string | null;
  tool?: ToolId;
  favorite?: boolean;
  /** Matches the title or the body, case-insensitively. */
  query?: string;
}

export function listDocuments(options: DocumentListOptions = {}): StoredDocument[] {
  const needle = options.query?.trim().toLowerCase() ?? "";
  const documents = readCollection<StoredDocument>(STORAGE_KEYS.documents, memoryDocuments);
  return documents
    .filter((document) => (options.tool ? document.tool === options.tool : true))
    .filter((document) =>
      options.folderId === undefined ? true : document.folderId === options.folderId,
    )
    .filter((document) => (options.favorite ? document.favorite : true))
    .filter((document) =>
      needle ? `${document.title} ${document.text}`.toLowerCase().includes(needle) : true,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDocument(id: string): StoredDocument | null {
  const documents = readCollection<StoredDocument>(STORAGE_KEYS.documents, memoryDocuments);
  return documents.find((document) => document.id === id) ?? null;
}

export interface NewDocumentInput {
  title?: string;
  text?: string;
  tool?: ToolId;
  language?: StoredDocument["language"];
  folderId?: string | null;
  status?: StoredDocument["status"];
}

export function createDocument(input: NewDocumentInput = {}): StoredDocument {
  const now = new Date().toISOString();
  const text = input.text ?? "";
  const document: StoredDocument = {
    id: uid("doc"),
    title: input.title?.trim() || titleFromText(text),
    text,
    tool: input.tool ?? "detector",
    language: input.language ?? "en",
    folderId: input.folderId ?? null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    wordCount: countWords(text),
    status: input.status ?? "draft",
  };
  const next = [document, ...listDocuments()];
  writeCollection(STORAGE_KEYS.documents, next, (value) => (memoryDocuments = value));
  return document;
}

export function updateDocument(
  id: string,
  patch: Partial<Omit<StoredDocument, "id" | "createdAt">>,
): StoredDocument | null {
  const documents = listDocuments();
  let updated: StoredDocument | null = null;
  const next = documents.map((document) => {
    if (document.id !== id) return document;
    const text = patch.text ?? document.text;
    updated = {
      ...document,
      ...patch,
      text,
      wordCount: text === document.text ? document.wordCount : countWords(text),
      title: patch.title?.trim() || document.title,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  if (updated) writeCollection(STORAGE_KEYS.documents, next, (value) => (memoryDocuments = value));
  return updated;
}

/** Autosave path: same as update but leaves `updatedAt` to the caller's clock. */
export function saveDocumentText(id: string, text: string): StoredDocument | null {
  return updateDocument(id, { text });
}

export function renameDocument(id: string, title: string): StoredDocument | null {
  return updateDocument(id, { title });
}

export function toggleFavorite(id: string): StoredDocument | null {
  const document = getDocument(id);
  return document ? updateDocument(id, { favorite: !document.favorite }) : null;
}

export function duplicateDocument(id: string): StoredDocument | null {
  const source = getDocument(id);
  if (!source) return null;
  const now = new Date().toISOString();
  const copy: StoredDocument = {
    ...source,
    id: uid("doc"),
    title: `${source.title} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  const next = [copy, ...listDocuments()];
  writeCollection(STORAGE_KEYS.documents, next, (value) => (memoryDocuments = value));
  return copy;
}

export function deleteDocument(id: string): void {
  const next = listDocuments().filter((document) => document.id !== id);
  writeCollection(STORAGE_KEYS.documents, next, (value) => (memoryDocuments = value));
  const history = listHistory().filter((entry) => entry.documentId !== id);
  writeCollection(STORAGE_KEYS.history, history, (value) => (memoryHistory = value));
}

export function moveDocument(id: string, folderId: string | null): StoredDocument | null {
  return updateDocument(id, { folderId });
}

/* -------------------------------------------------------------------- folders */

export function listFolders(): Folder[] {
  return readJson<Folder[]>(STORAGE_KEYS.folders, memoryFolders ?? []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function createFolder(name: string, parentId: string | null = null): Folder {
  const folder: Folder = { id: uid("folder"), name: name.trim() || "Untitled folder", parentId, createdAt: new Date().toISOString() };
  const next = [...listFolders(), folder];
  if (storingAllowed()) writeJson(STORAGE_KEYS.folders, next);
  else memoryFolders = next;
  return folder;
}

export function renameFolder(id: string, name: string): Folder | null {
  const folders = listFolders();
  let renamed: Folder | null = null;
  const next = folders.map((folder) => {
    if (folder.id !== id) return folder;
    renamed = { ...folder, name: name.trim() || folder.name };
    return renamed;
  });
  if (renamed) {
    if (storingAllowed()) writeJson(STORAGE_KEYS.folders, next);
    else memoryFolders = next;
  }
  return renamed;
}

/** Deleting a folder keeps its documents: they move back to the unfiled list. */
export function deleteFolder(id: string): void {
  const next = listFolders().filter((folder) => folder.id !== id);
  if (storingAllowed()) writeJson(STORAGE_KEYS.folders, next);
  else memoryFolders = next;
  const documents = listDocuments().map((document) =>
    document.folderId === id ? { ...document, folderId: null } : document,
  );
  writeCollection(STORAGE_KEYS.documents, documents, (value) => (memoryDocuments = value));
}

/* ---------------------------------------------------------------- ---- history */

export function listHistory(): HistoryEntry[] {
  return readCollection<HistoryEntry>(STORAGE_KEYS.history, memoryHistory).sort((a, b) =>
    b.analyzedAt.localeCompare(a.analyzedAt),
  );
}

export function saveHistoryEntry(entry: HistoryEntry): boolean {
  const next = [entry, ...listHistory().filter((item) => item.id !== entry.id)];
  return writeCollection(STORAGE_KEYS.history, next, (value) => (memoryHistory = value));
}

export function getHistoryEntry(id: string): HistoryEntry | null {
  return listHistory().find((entry) => entry.id === id) ?? null;
}

export function renameHistoryEntry(id: string, title: string): HistoryEntry | null {
  const entries = listHistory();
  let renamed: HistoryEntry | null = null;
  const next = entries.map((entry) => {
    if (entry.id !== id) return entry;
    renamed = { ...entry, title: title.trim() || entry.title };
    return renamed;
  });
  if (renamed) writeCollection(STORAGE_KEYS.history, next, (value) => (memoryHistory = value));
  return renamed;
}

export function deleteHistoryEntry(id: string): void {
  const next = listHistory().filter((entry) => entry.id !== id);
  writeCollection(STORAGE_KEYS.history, next, (value) => (memoryHistory = value));
}

export function clearHistory(): void {
  if (storingAllowed()) remove(STORAGE_KEYS.history);
  memoryHistory = [];
}

/** Two runs can land in the same millisecond; ids keep the order reproducible. */
const byNewest = (a: HistoryEntry, b: HistoryEntry) =>
  b.analyzedAt.localeCompare(a.analyzedAt) || b.id.localeCompare(a.id);

const SORTS: Record<HistorySort, (a: HistoryEntry, b: HistoryEntry) => number> = {
  newest: byNewest,
  oldest: (a, b) => -byNewest(a, b),
  "highest-ai": (a, b) => b.aiProbability - a.aiProbability || byNewest(a, b),
  "lowest-ai": (a, b) => a.aiProbability - b.aiProbability || -byNewest(a, b),
  longest: (a, b) => b.wordCount - a.wordCount || byNewest(a, b),
};

export function searchHistory(filters: HistoryFilter = {}): HistoryPage {
  const { query = "", tool, classification, confidence, from, to, sort = "newest" } = filters;
  const needle = query.trim().toLowerCase();
  const pageSize = Math.max(1, filters.pageSize ?? 12);
  const page = Math.max(1, filters.page ?? 1);

  const entries = listHistory()
    .filter((entry) => (needle ? `${entry.title} ${entry.tool}`.toLowerCase().includes(needle) : true))
    .filter((entry) => (tool && tool !== "all" ? entry.tool === tool : true))
    .filter((entry) =>
      classification && classification !== "all" ? entry.classification === classification : true,
    )
    .filter((entry) =>
      confidence && confidence !== "all" ? entry.confidence === confidence : true,
    )
    .filter((entry) => (from ? entry.analyzedAt >= from : true))
    .filter((entry) => (to ? entry.analyzedAt <= `${to}T23:59:59.999Z` : true))
    .sort(SORTS[sort] ?? SORTS.newest);

  const total = entries.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  return {
    entries: entries.slice((safePage - 1) * pageSize, safePage * pageSize),
    total,
    page: safePage,
    pageSize,
    pageCount,
  };
}

/* -------------------------------------------------------------------- records */

export interface AnalysisRecord {
  entry: HistoryEntry;
  document: StoredDocument;
  /** False when the write stayed in memory: local saving is off, or storage refused it. */
  persisted: boolean;
}

export interface SaveAnalysisInput {
  result: DetectionResult;
  /** The exact text the engine measured — a record without it cannot be reopened. */
  text: string;
  title?: string;
  /** Reuses the document already open in the editor instead of storing a second copy. */
  documentId?: string | null;
  tool?: ToolId;
}

/**
 * Stores a finished analysis as a history row plus the document it describes, so
 * opening the row later returns the same text the scores were made from.
 */
export function saveAnalysis(input: SaveAnalysisInput): AnalysisRecord {
  const tool = input.tool ?? "detector";
  const existing = input.documentId ? getDocument(input.documentId) : null;
  const document = existing
    ? (updateDocument(existing.id, {
        text: input.text,
        title: input.title,
        language: input.result.language,
        status: "completed",
      }) ?? existing)
    : createDocument({
        title: input.title,
        text: input.text,
        tool,
        language: input.result.language,
        status: "completed",
      });

  const entry: HistoryEntry = {
    id: uid("hist"),
    documentId: document.id,
    title: document.title,
    tool,
    analyzedAt: input.result.analyzedAt,
    wordCount: input.result.metrics.words,
    aiProbability: input.result.aiProbability,
    classification: input.result.classification,
    confidence: input.result.confidence,
    status: "completed",
    result: input.result,
  };
  const persisted = saveHistoryEntry(entry);
  return { entry, document, persisted };
}

/** A stored row together with the document that holds its text, if it still exists. */
export function getAnalysisRecord(
  entryId: string,
): { entry: HistoryEntry; document: StoredDocument | null } | null {
  const entry = getHistoryEntry(entryId);
  if (!entry) return null;
  return { entry, document: getDocument(entry.documentId) };
}

/**
 * Copies a row and its document. The copy keeps the original `analyzedAt`, because
 * duplicating a record does not re-measure anything.
 */
export function duplicateAnalysis(entryId: string): AnalysisRecord | null {
  const source = getAnalysisRecord(entryId);
  if (!source || !source.document) return null;
  const copy = duplicateDocument(source.document.id);
  if (!copy) return null;
  const entry: HistoryEntry = {
    ...source.entry,
    id: uid("hist"),
    documentId: copy.id,
    title: copy.title,
  };
  const persisted = saveHistoryEntry(entry);
  return { entry, document: copy, persisted };
}

/**
 * The whole record as JSON: the row, the document text and the full engine output.
 * A report document is generated in a later phase; this is the raw measurement.
 */
export function serializeAnalysis(entry: HistoryEntry): string {
  const document = getDocument(entry.documentId);
  return JSON.stringify(
    {
      kind: "veriwrite.analysis",
      exportedAt: new Date().toISOString(),
      disclaimer: DETECTION_DISCLAIMER_SHORT,
      document: document
        ? {
            id: document.id,
            title: document.title,
            language: document.language,
            words: document.wordCount,
            text: document.text,
          }
        : null,
      analysis: entry.result,
    },
    null,
    2,
  );
}

/* ---------------------------------------------------------------------- stats */

export interface WorkspaceStats {
  documents: number;
  wordsStored: number;
  analyses: number;
  favoriteDocuments: number;
}

export function getWorkspaceStats(): WorkspaceStats {
  const documents = listDocuments();
  const history = listHistory();
  return {
    documents: documents.length,
    wordsStored: documents.reduce((sum, document) => sum + document.wordCount, 0),
    analyses: history.length,
    favoriteDocuments: documents.filter((document) => document.favorite).length,
  };
}

/* --------------------------------------------------------- the library over REST */

/** Where the rows the pages list actually sit. Printed on the page, never assumed. */
export type LibrarySource = "this browser's storage" | "api service";

export interface LibraryCapabilities {
  source: LibrarySource;
  backendConfigured: boolean;
  /** False when local saving is switched off: a device library then lasts one session. */
  persisting: boolean;
  note: string;
}

export function getLibraryCapabilities(): LibraryCapabilities {
  return backendConfigured()
    ? {
        source: "api service",
        backendConfigured: true,
        persisting: true,
        note: "Documents, folders and saved analyses are read from and written to the attached service. Nothing the pages list is kept only on this device.",
      }
    : {
        source: "this browser's storage",
        backendConfigured: false,
        persisting: storingAllowed(),
        note: storingAllowed()
          ? "No library service is attached, so the rows live in this browser under the vw. keys and the browser's own storage controls are the only ones that govern them."
          : "No library service is attached and local saving is off, so the rows you see are held for this session only and nothing is written to this device.",
      };
}

/** The tool ids, enumerated through the union so a new one fails the build here. */
const TOOL_VALUES: Record<ToolId, true> = {
  detector: true,
  paraphraser: true,
  humanizer: true,
  grammar: true,
  plagiarism: true,
  summarizer: true,
  translator: true,
  citations: true,
  writer: true,
};

const STATUS_VALUES: Record<AnalysisStatus, true> = {
  draft: true,
  processing: true,
  completed: true,
  failed: true,
};

/** A member of one of the app's own unions, or null. An unknown value is never renamed. */
function known<T extends string>(
  value: unknown,
  table: Record<T, true> | Record<T, string>,
): T | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(table, value)
    ? (value as T)
    : null;
}

function stamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/**
 * A service row the app cannot label is a row it does not show: a document with an
 * unknown tool would file itself under a name the union does not contain, and a card
 * with no id cannot be opened, renamed or deleted.
 */
function parseStoredDocument(raw: unknown): StoredDocument | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : null;
  const text = typeof row.text === "string" ? row.text : null;
  const title = typeof row.title === "string" ? row.title : null;
  const tool = known<ToolId>(row.tool, TOOL_VALUES);
  const language = known<LanguageCode>(row.language, LANGUAGE_NAMES);
  const status = known<AnalysisStatus>(row.status, STATUS_VALUES);
  const updatedAt = stamp(row.updatedAt) ?? stamp(row.createdAt);
  if (id === null || text === null || title === null || tool === null || language === null || status === null || updatedAt === null) {
    return null;
  }
  return {
    id,
    title: title.trim() || titleFromText(text),
    text,
    tool,
    language,
    status,
    folderId: typeof row.folderId === "string" ? row.folderId : null,
    favorite: row.favorite === true,
    createdAt: stamp(row.createdAt) ?? updatedAt,
    updatedAt,
    // A row that does not say how long it is gets measured here, the same way a new
    // local document is, rather than shown as zero words.
    wordCount: optionalNumber(row, "wordCount", countWords(text)),
  };
}

function parseFolderRow(raw: unknown): Folder | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : null;
  const name = typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : null;
  const createdAt = stamp(row.createdAt);
  if (id === null || name === null || createdAt === null) return null;
  return { id, name, parentId: typeof row.parentId === "string" ? row.parentId : null, createdAt };
}

/** Only the fields the result cards read are checked; anything else stays unread. */
function usableResult(raw: unknown): DetectionResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const classification = known<Classification>(row.classification, CLASSIFICATION_LABEL);
  const confidence = known<ConfidenceLevel>(row.confidence, CONFIDENCE_LABEL);
  const probability = typeof row.aiProbability === "number" && Number.isFinite(row.aiProbability) ? row.aiProbability : null;
  if (
    classification === null ||
    confidence === null ||
    probability === null ||
    !Array.isArray(row.sentences) ||
    !row.metrics ||
    typeof row.metrics !== "object"
  ) {
    return null;
  }
  return raw as DetectionResult;
}

function parseHistoryRow(raw: unknown): HistoryEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : null;
  const title = typeof row.title === "string" ? row.title : null;
  const tool = known<ToolId>(row.tool, TOOL_VALUES);
  const status = known<AnalysisStatus>(row.status, STATUS_VALUES);
  const classification = known<Classification>(row.classification, CLASSIFICATION_LABEL);
  const confidence = known<ConfidenceLevel>(row.confidence, CONFIDENCE_LABEL);
  const analyzedAt = stamp(row.analyzedAt);
  const probability = typeof row.aiProbability === "number" && Number.isFinite(row.aiProbability) ? row.aiProbability : null;
  if (
    id === null ||
    title === null ||
    tool === null ||
    status === null ||
    classification === null ||
    confidence === null ||
    analyzedAt === null ||
    probability === null
  ) {
    return null;
  }
  return {
    id,
    documentId: typeof row.documentId === "string" ? row.documentId : "",
    title: title.trim() || "Untitled analysis",
    tool,
    analyzedAt,
    wordCount: optionalNumber(row, "wordCount"),
    aiProbability: probability,
    classification,
    confidence,
    status,
    // A row without a result it can hand back opens as a summary, not as a fake score.
    result: usableResult(row.result),
  };
}

/** `{ documents: [...] }`, `{ entries: [...] }` or a bare list — the three shapes a list can take. */
function rowsOf(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object" && payload !== null) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function parseRows<T>(payload: unknown, key: string, parse: (raw: unknown) => T | null): T[] {
  const out: T[] = [];
  for (const raw of rowsOf(payload, key)) {
    const row = parse(raw);
    if (row) out.push(row);
  }
  return out;
}

export interface LibrarySnapshot {
  source: LibrarySource;
  documents: StoredDocument[];
  folders: Folder[];
  /** Saved analyses, counted wherever the library sits. */
  analyses: number;
  /** Rows the service sent that this build could not show, so a page can say so. */
  unreadable: number;
}

export async function loadLibrary(): Promise<LibrarySnapshot> {
  if (!backendConfigured()) {
    const documents = listDocuments();
    return {
      source: "this browser's storage",
      documents,
      folders: listFolders(),
      analyses: listHistory().length,
      unreadable: 0,
    };
  }

  const [documentPayload, folderPayload, historyPayload] = await Promise.all([
    apiRequest<unknown>("/api/documents"),
    apiRequest<unknown>("/api/folders"),
    apiRequest<unknown>("/api/history", { query: { page: 1, pageSize: 1 } }),
  ]);
  const documents = parseRows(documentPayload, "documents", parseStoredDocument);
  const folders = parseRows(folderPayload, "folders", parseFolderRow).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return {
    source: "api service",
    documents,
    folders,
    analyses: historyTotal(historyPayload),
    // Rows the service sent that this build could not label. A page says so out loud
    // rather than showing a shorter list than the library holds.
    unreadable:
      rowsOf(documentPayload, "documents").length -
      documents.length +
      (rowsOf(folderPayload, "folders").length - folders.length),
  };
}

/** The total the service states; a page of rows it sent is the most that can be claimed. */
function historyTotal(payload: unknown): number {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    const row = payload as Record<string, unknown>;
    if (typeof row.total === "number" && Number.isFinite(row.total)) return row.total;
  }
  return rowsOf(payload, "entries").length;
}

export async function loadHistory(filters: HistoryFilter = {}): Promise<HistoryPage> {
  if (!backendConfigured()) return searchHistory(filters);

  const payload = await apiRequest<unknown>("/api/history", {
    query: {
      query: filters.query?.trim() || undefined,
      tool: filters.tool && filters.tool !== "all" ? filters.tool : undefined,
      classification:
        filters.classification && filters.classification !== "all" ? filters.classification : undefined,
      confidence: filters.confidence && filters.confidence !== "all" ? filters.confidence : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sort: filters.sort ?? undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 12,
    },
  });
  const entries = parseRows(payload, "entries", parseHistoryRow);
  const body =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const pageSize = Math.max(1, optionalNumber(body, "pageSize", filters.pageSize ?? 12));
  const total = historyTotal(payload);
  const pageCount = Math.max(1, optionalNumber(body, "pageCount", Math.ceil(total / pageSize)));
  const page = Math.min(
    Math.max(1, optionalNumber(body, "page", filters.page ?? 1)),
    pageCount,
  );
  return { entries, total, page, pageSize, pageCount };
}

/** A row the service says it does not have reads as "not there", not as a failed call. */
function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export async function loadDocuments(options: DocumentListOptions = {}): Promise<StoredDocument[]> {
  if (!backendConfigured()) return listDocuments(options);
  const payload = await apiRequest<unknown>("/api/documents", {
    query: {
      // Omitted means "any folder"; `none` is the unfiled list, which no folder id can name.
      folderId:
        options.folderId === undefined ? undefined : options.folderId === null ? "none" : options.folderId,
      tool: options.tool ?? undefined,
      favorite: options.favorite ?? undefined,
      query: options.query?.trim() || undefined,
    },
  });
  return parseRows(payload, "documents", parseStoredDocument);
}

export async function loadDocument(id: string): Promise<StoredDocument | null> {
  if (!backendConfigured()) return getDocument(id);
  try {
    const payload = await apiRequest<unknown>(`/api/documents/${encodeURIComponent(id)}`);
    return mustParse(payload, "document", parseStoredDocument, "saved document");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/**
 * One saved analysis with the text it measured, which is what reopening it needs. A row
 * whose document the service no longer has comes back with `document: null`, the same way
 * the local store does, so the screen can say the text is gone rather than open empty.
 */
export async function loadAnalysisRecord(
  id: string,
): Promise<{ entry: HistoryEntry; document: StoredDocument | null } | null> {
  if (!backendConfigured()) return getAnalysisRecord(id);
  let payload: unknown;
  try {
    payload = await apiRequest<unknown>(`/api/analyses/${encodeURIComponent(id)}`);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  const body = requireRecord(payload, "library");
  const entry = parseHistoryRow(body.entry ?? payload);
  if (!entry) return null;
  return { entry, document: parseStoredDocument(body.document ?? null) };
}

function documentBody(input: NewDocumentInput): Record<string, unknown> {
  const text = input.text ?? "";
  return {
    title: input.title?.trim() || titleFromText(text),
    text,
    tool: input.tool ?? "detector",
    language: input.language ?? "en",
    folderId: input.folderId ?? null,
    status: input.status ?? "draft",
  };
}

/** The service's answer to a write, or an error that says the row did not come back. */
function mustParse<T>(
  payload: unknown,
  key: string,
  parse: (raw: unknown) => T | null,
  what: string,
): T {
  const direct = parse(payload);
  if (direct) return direct;
  if (typeof payload === "object" && payload !== null) {
    const nested = parse((payload as Record<string, unknown>)[key]);
    if (nested) return nested;
  }
  throw new ApiError("api", `The library service accepted the request but sent back no ${what}.`);
}

export async function putDocument(input: NewDocumentInput): Promise<StoredDocument> {
  if (!backendConfigured()) return createDocument(input);
  const payload = await apiRequest<unknown>("/api/documents", {
    method: "POST",
    body: documentBody(input),
  });
  return mustParse(payload, "document", parseStoredDocument, "saved document");
}

/**
 * The write, wherever the library sits. A row this device no longer holds answers as
 * `null`, the way the local store always has; a service that refuses a write says so
 * as an error the page can show, because "nothing happened" is not the same fact.
 */
export async function putDocumentText(id: string, text: string): Promise<StoredDocument | null> {
  if (!backendConfigured()) return saveDocumentText(id, text);
  const payload = await apiRequest<unknown>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    // Only the text travels; the service recounts the words, as it did on the write.
    body: { text },
  });
  return mustParse(payload, "document", parseStoredDocument, "saved document");
}

export async function patchDocument(
  id: string,
  patch: Partial<Omit<StoredDocument, "id" | "createdAt">>,
): Promise<StoredDocument | null> {
  if (!backendConfigured()) return updateDocument(id, patch);
  const body: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (value !== undefined) body[field] = value;
  }
  const payload = await apiRequest<unknown>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
  return mustParse(payload, "document", parseStoredDocument, "saved document");
}

export async function copyDocument(id: string): Promise<StoredDocument | null> {
  if (!backendConfigured()) return duplicateDocument(id);
  const payload = await apiRequest<unknown>(
    `/api/documents/${encodeURIComponent(id)}/duplicate`,
    { method: "POST" },
  );
  return mustParse(payload, "document", parseStoredDocument, "copy");
}

export async function removeDocument(id: string): Promise<void> {
  if (!backendConfigured()) {
    deleteDocument(id);
    return;
  }
  await apiRequest<unknown>(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function putFolder(name: string, parentId: string | null = null): Promise<Folder> {
  if (!backendConfigured()) return createFolder(name, parentId);
  const payload = await apiRequest<unknown>("/api/folders", {
    method: "POST",
    body: { name: name.trim() || "Untitled folder", parentId },
  });
  return mustParse(payload, "folder", parseFolderRow, "saved folder");
}

export async function patchFolder(id: string, name: string): Promise<Folder | null> {
  if (!backendConfigured()) return renameFolder(id, name);
  const payload = await apiRequest<unknown>(`/api/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { name: name.trim() },
  });
  return mustParse(payload, "folder", parseFolderRow, "saved folder");
}

export async function removeFolder(id: string): Promise<void> {
  if (!backendConfigured()) {
    deleteFolder(id);
    return;
  }
  await apiRequest<unknown>(`/api/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function putAnalysis(input: SaveAnalysisInput): Promise<AnalysisRecord> {
  if (!backendConfigured()) return saveAnalysis(input);
  const payload = requireRecord(
    await apiRequest<unknown>("/api/analyses", {
      method: "POST",
      body: {
        text: input.text,
        title: input.title?.trim() || undefined,
        documentId: input.documentId ?? null,
        tool: input.tool ?? "detector",
        // The engine ran here, so the measurement travels with the row it belongs to.
        result: input.result,
      },
    }),
    "library",
  );
  const entry = parseHistoryRow(payload.entry ?? payload);
  if (!entry) {
    throw new ApiError("api", "The library service accepted the analysis but sent back no row for it.");
  }
  const document = parseStoredDocument(payload.document ?? null);
  if (!document) {
    // A row whose text the service will not hand back cannot be reopened, so it is
    // reported as a failed save rather than stored half.
    throw new ApiError("api", "The library service saved the analysis but sent back no document text.");
  }
  return { entry, document, persisted: true };
}

/**
 * A second copy of a row and its text. The service does the copying so the original is
 * untouched there too; a local duplicate is the same call the store has always made.
 */
export async function copyAnalysis(
  entryId: string,
): Promise<{ entry: HistoryEntry; document: StoredDocument | null } | null> {
  if (!backendConfigured()) return duplicateAnalysis(entryId);
  let payload: unknown;
  try {
    payload = await apiRequest<unknown>(
      `/api/analyses/${encodeURIComponent(entryId)}/duplicate`,
      { method: "POST" },
    );
  } catch (error) {
    // 404 here means the text behind the row is gone, which is the same fact the local
    // store answers with `null`.
    if (isMissing(error)) return null;
    throw error;
  }
  const body = requireRecord(payload, "library");
  const entry = parseHistoryRow(body.entry ?? payload);
  if (!entry) {
    throw new ApiError("api", "The library service duplicated the row but sent back no copy of it.");
  }
  return { entry, document: parseStoredDocument(body.document ?? null) };
}

export async function patchHistory(id: string, title: string): Promise<HistoryEntry | null> {
  if (!backendConfigured()) return renameHistoryEntry(id, title);
  const payload = await apiRequest<unknown>(`/api/history/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { title: title.trim() },
  });
  return mustParse(payload, "entry", parseHistoryRow, "saved analysis");
}

export async function removeHistory(id: string): Promise<void> {
  if (!backendConfigured()) {
    deleteHistoryEntry(id);
    return;
  }
  await apiRequest<unknown>(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function clearHistoryRows(): Promise<void> {
  if (!backendConfigured()) {
    clearHistory();
    return;
  }
  await apiRequest<unknown>("/api/history", { method: "DELETE" });
}

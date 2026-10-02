/**
 * The development store: the same rows, relations and delete rules as
 * `src/db/migrations/0001_initial_schema.sql`, held in arrays instead of in a database.
 *
 * It exists so this backend can actually run — `npm run dev` in the frontend plus
 * `node backend/src/index.ts` gives the pages a real service to talk to, and the contract
 * harness can drive the real client through the real routes. It is not the production
 * store: nothing here is durable, and restarting the process loses every row. The services
 * in `src/services/` are this file's only callers, which is what makes the swap contained:
 * a real driver implements the same methods against the tables in the migration and
 * nothing above the store changes.
 *
 * The delete rules are copied from the SQL cascade clauses on purpose. A test that the
 * browser's store and this one agree is worth more than a test of either alone.
 */
import { randomUUID } from "node:crypto";
import type {
  AnalysisRow,
  AuditEventRow,
  DocumentRow,
  FolderRow,
  HistoryRow,
  ProcessingJobRow,
  SentenceAnalysisRow,
  SubscriptionRow,
  UsageCounterRow,
  UsageDayRow,
  UserRow,
  UserSessionRow,
} from "../models/index.ts";
import { countWords } from "../schemas/wire.ts";

/** The user every request in this store belongs to. See `api/middleware.ts`. */
export const WORKSPACE_USER_ID = "00000000-0000-4000-8000-000000000001";

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return randomUUID();
}

export interface DocumentRowPatch {
  title?: string;
  body?: string;
  language?: string;
  status?: DocumentRow["status"];
  folderId?: string | null;
  favorite?: boolean;
}

export class MemoryStore {
  // Not `readonly`: a cascading delete rebuilds these arrays from a filter.
  users: UserRow[] = [];
  sessions: UserSessionRow[] = [];
  subscriptions: SubscriptionRow[] = [];
  folders: FolderRow[] = [];
  documents: DocumentRow[] = [];
  analyses: AnalysisRow[] = [];
  sentenceAnalyses: SentenceAnalysisRow[] = [];
  history: HistoryRow[] = [];
  usageCounters: UsageCounterRow[] = [];
  usageDays: UsageDayRow[] = [];
  jobs: ProcessingJobRow[] = [];
  auditEvents: AuditEventRow[] = [];

  /** Rows are written from now on for one user only; see the README's scope note. */
  constructor() {
    const at = now();
    this.users.push({
      id: WORKSPACE_USER_ID,
      email: "workspace@veriwrite.local",
      name: "Workspace",
      password_hash: null,
      role: "user",
      status: "active",
      locale: "en",
      email_verified_at: null,
      last_login_at: null,
      created_at: at,
      updated_at: at,
    });
  }

  /* ------------------------------------------------------------------ users */

  getUser(userId: string): UserRow | undefined {
    return this.users.find((user) => user.id === userId);
  }

  /** The session the presented token belongs to, if it is live. Tokens are never stored. */
  getSession(tokenHash: string): UserSessionRow | undefined {
    const at = Date.now();
    return this.sessions.find(
      (session) =>
        session.token_hash === tokenHash &&
        session.revoked_at === null &&
        Date.parse(session.expires_at) > at,
    );
  }

  addSession(session: Omit<UserSessionRow, "id">): UserSessionRow {
    const row: UserSessionRow = { ...session, id: id() };
    this.sessions.push(row);
    return row;
  }

  /**
   * A live session already minted for this client address and agent. Without it every
   * anonymous request would add a row — invisible in a browser, which sends the cookie
   * back, and unbounded in a process that does not.
   */
  liveSessionFor(ip: string | null, userAgent: string | null): UserSessionRow | undefined {
    return this.sessions.find(
      (session) =>
        session.revoked_at === null &&
        Date.parse(session.expires_at) > Date.now() &&
        session.ip === ip &&
        session.user_agent === userAgent,
    );
  }

  revokeSession(tokenHash: string): void {
    const session = this.getSession(tokenHash);
    if (session) session.revoked_at = now();
  }

  /** The live plan the quota guard reads; `null` is the free plan, not an error. */
  getSubscription(userId: string): SubscriptionRow | null {
    return (
      this.subscriptions.find(
        (row) =>
          row.user_id === userId &&
          ["active", "trialing", "past_due"].includes(row.status) &&
          Date.parse(row.current_period_end) > Date.now(),
      ) ?? null
    );
  }

  /* ----------------------------------------------------------------- audit */

  audit(event: Omit<AuditEventRow, "id" | "at">): void {
    this.auditEvents.push({ ...event, id: this.auditEvents.length + 1, at: now() });
  }

  /* ---------------------------------------------------------------- folders */

  listFolders(userId: string): FolderRow[] {
    return this.folders.filter((folder) => folder.user_id === userId);
  }

  getFolder(userId: string, folderId: string): FolderRow | undefined {
    return this.folders.find((folder) => folder.id === folderId && folder.user_id === userId);
  }

  /** `folders_name_per_user`: two folders at the same level cannot share a name. */
  folderNameTaken(userId: string, name: string, parentId: string | null): boolean {
    return this.folders.some(
      (folder) => folder.user_id === userId && folder.parent_id === parentId && folder.name === name,
    );
  }

  addFolder(input: { user_id: string; name: string; parent_id: string | null }): FolderRow {
    const at = now();
    const row: FolderRow = {
      id: id(),
      user_id: input.user_id,
      name: input.name,
      parent_id: input.parent_id,
      created_at: at,
      updated_at: at,
    };
    this.folders.push(row);
    return row;
  }

  renameFolder(userId: string, folderId: string, name: string): FolderRow | null {
    const folder = this.getFolder(userId, folderId);
    if (!folder) return null;
    folder.name = name;
    folder.updated_at = now();
    return folder;
  }

  /** `on delete set null` on `documents.folder_id` and on a child folder's `parent_id`. */
  deleteFolder(userId: string, folderId: string): boolean {
    const index = this.folders.findIndex(
      (folder) => folder.id === folderId && folder.user_id === userId,
    );
    if (index < 0) return false;
    this.folders.splice(index, 1);
    for (const document of this.documents) {
      if (document.folder_id === folderId) {
        document.folder_id = null;
        document.updated_at = now();
      }
    }
    for (const folder of this.folders) {
      if (folder.parent_id === folderId) folder.parent_id = null;
    }
    return true;
  }

  /* -------------------------------------------------------------- documents */

  getDocument(userId: string, documentId: string): DocumentRow | undefined {
    return this.documents.find(
      (document) => document.id === documentId && document.user_id === userId,
    );
  }

  /** Most recently edited first, the order the Documents page lists. */
  listDocuments(userId: string): DocumentRow[] {
    return this.documents
      .filter((document) => document.user_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id));
  }

  addDocument(input: {
    user_id: string;
    title: string;
    body: string;
    tool: DocumentRow["tool"];
    language: string;
    status: DocumentRow["status"];
    folder_id: string | null;
  }): DocumentRow {
    const at = now();
    const row: DocumentRow = {
      id: id(),
      user_id: input.user_id,
      folder_id: input.folder_id,
      title: input.title,
      body: input.body,
      tool: input.tool,
      language: input.language,
      status: input.status,
      // The service counts on every write; a client that never reads a body still gets a
      // word count, which is what the list sorts and the quota adds up.
      word_count: countWords(input.body),
      favorite: false,
      created_at: at,
      updated_at: at,
    };
    this.documents.unshift(row);
    return row;
  }

  patchDocument(userId: string, documentId: string, patch: DocumentRowPatch): DocumentRow | null {
    const document = this.getDocument(userId, documentId);
    if (!document) return null;
    if (patch.title !== undefined) document.title = patch.title;
    if (patch.body !== undefined) {
      document.body = patch.body;
      document.word_count = countWords(patch.body);
    }
    if (patch.language !== undefined) document.language = patch.language;
    if (patch.status !== undefined) document.status = patch.status;
    if (patch.folderId !== undefined) document.folder_id = patch.folderId;
    if (patch.favorite !== undefined) document.favorite = patch.favorite;
    // `documents_touch` in SQL: the timestamp moves on every write, unasked.
    document.updated_at = now();
    return document;
  }

  /**
   * `on delete cascade` for history and analyses, `set null` for the rows that only
   * mention a document. A deleted document leaves no row that still claims to describe it.
   */
  deleteDocument(userId: string, documentId: string): boolean {
    const index = this.documents.findIndex(
      (document) => document.id === documentId && document.user_id === userId,
    );
    if (index < 0) return false;
    this.documents.splice(index, 1);
    this.history = this.history.filter((row) => row.document_id !== documentId);
    const gone = this.analyses.filter((row) => row.document_id === documentId).map((row) => row.id);
    this.analyses = this.analyses.filter((row) => row.document_id !== documentId);
    for (const analysisId of gone) this.deleteAnalysisRows(analysisId);
    this.jobs = this.jobs.filter((job) => job.document_id !== documentId);
    return true;
  }

  /* --------------------------------------------------------------- analyses */

  getAnalysis(userId: string, analysisId: string): AnalysisRow | undefined {
    return this.analyses.find(
      (analysis) => analysis.id === analysisId && analysis.user_id === userId,
    );
  }

  addAnalysis(
    input: Omit<AnalysisRow, "id" | "created_at">,
    sentences: Omit<SentenceAnalysisRow, "id" | "analysis_id">[] = [],
  ): AnalysisRow {
    const row: AnalysisRow = { ...input, id: id(), created_at: now() };
    this.analyses.unshift(row);
    for (const sentence of sentences) {
      this.sentenceAnalyses.push({ ...sentence, id: id(), analysis_id: row.id });
    }
    return row;
  }

  listSentences(analysisId: string): SentenceAnalysisRow[] {
    return this.sentenceAnalyses
      .filter((row) => row.analysis_id === analysisId)
      .sort((a, b) => a.ordinal - b.ordinal);
  }

  /** `sentence_analyses … on delete cascade`, and `history.analysis_id … on delete set null`. */
  private deleteAnalysisRows(analysisId: string): void {
    this.sentenceAnalyses = this.sentenceAnalyses.filter((row) => row.analysis_id !== analysisId);
    for (const row of this.history) {
      if (row.analysis_id === analysisId) {
        row.analysis_id = null;
        row.result_present = false;
      }
    }
  }

  deleteAnalysis(userId: string, analysisId: string): boolean {
    const analysis = this.getAnalysis(userId, analysisId);
    if (!analysis) return false;
    this.analyses = this.analyses.filter((row) => row.id !== analysisId);
    this.deleteAnalysisRows(analysisId);
    return true;
  }

  /* ---------------------------------------------------------------- history */

  getHistoryEntry(userId: string, entryId: string): HistoryRow | undefined {
    return this.history.find((row) => row.id === entryId && row.user_id === userId);
  }

  listHistory(userId: string): HistoryRow[] {
    return this.history
      .filter((row) => row.user_id === userId)
      .sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at) || b.id.localeCompare(a.id));
  }

  /** The analysis behind a row, or `null` when the row is a summary of a run that is gone. */
  analysisFor(entry: HistoryRow): AnalysisRow | null {
    if (!entry.result_present || entry.analysis_id === null) return null;
    return this.analyses.find((row) => row.id === entry.analysis_id) ?? null;
  }

  addHistory(input: Omit<HistoryRow, "id" | "created_at">): HistoryRow {
    const row: HistoryRow = { ...input, id: id(), created_at: now() };
    this.history.unshift(row);
    return row;
  }

  patchHistory(userId: string, entryId: string, title: string): HistoryRow | null {
    const entry = this.getHistoryEntry(userId, entryId);
    if (!entry) return null;
    entry.title = title;
    return entry;
  }

  deleteHistoryEntry(userId: string, entryId: string): boolean {
    const index = this.history.findIndex(
      (row) => row.id === entryId && row.user_id === userId,
    );
    if (index < 0) return false;
    this.history.splice(index, 1);
    return true;
  }

  clearHistory(userId: string): number {
    const before = this.history.length;
    this.history = this.history.filter((row) => row.user_id !== userId);
    return before - this.history.length;
  }

  /* ------------------------------------------------------------------ usage */

  usageCounter(userId: string, period: string): UsageCounterRow | undefined {
    return this.usageCounters.find((row) => row.user_id === userId && row.period === period);
  }

  /** The day buckets whose date falls in one of the given `YYYY-MM` periods. */
  daysIn(userId: string, periods: string[]): UsageDayRow[] {
    return this.usageDays
      .filter((row) => row.user_id === userId && periods.includes(row.day.slice(0, 7)))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  /** The month counter and the day bucket move together, as they do in one transaction. */
  recordUsage(
    userId: string,
    period: string,
    day: string,
    delta: { words?: number; analyses?: number; rewrites?: number; plagiarism?: number; documents?: number },
  ): void {
    let counter = this.usageCounter(userId, period);
    if (!counter) {
      counter = {
        user_id: userId,
        period,
        words: 0,
        analyses: 0,
        rewrites: 0,
        plagiarism: 0,
        documents: 0,
        updated_at: now(),
      };
      this.usageCounters.push(counter);
    }
    counter.words += delta.words ?? 0;
    counter.analyses += delta.analyses ?? 0;
    counter.rewrites += delta.rewrites ?? 0;
    counter.plagiarism += delta.plagiarism ?? 0;
    counter.documents += delta.documents ?? 0;
    counter.updated_at = now();

    let bucket = this.usageDays.find((row) => row.user_id === userId && row.day === day);
    if (!bucket) {
      bucket = { user_id: userId, day, words: 0, analyses: 0, rewrites: 0, plagiarism: 0 };
      this.usageDays.push(bucket);
    }
    bucket.words += delta.words ?? 0;
    bucket.analyses += delta.analyses ?? 0;
    bucket.rewrites += delta.rewrites ?? 0;
    bucket.plagiarism += delta.plagiarism ?? 0;
  }

  /* -------------------------------------------------------- processing jobs */

  enqueueJob(input: {
    user_id: string;
    document_id: string | null;
    kind: ProcessingJobRow["kind"];
    payload: Record<string, unknown>;
    /** A job that must wait — a large upload, a retry with backoff. */
    runAfter?: string;
  }): ProcessingJobRow {
    const row: ProcessingJobRow = {
      id: id(),
      user_id: input.user_id,
      document_id: input.document_id,
      kind: input.kind,
      status: "queued",
      attempts: 0,
      payload: input.payload,
      result: null,
      error: null,
      run_after: input.runAfter ?? now(),
      created_at: now(),
      started_at: null,
      finished_at: null,
    };
    this.jobs.push(row);
    return row;
  }

  claimJob(): ProcessingJobRow | null {
    const at = now();
    const job = this.jobs.find(
      (row) => row.status === "queued" && Date.parse(row.run_after) <= Date.parse(at),
    );
    if (!job) return null;
    job.status = "running";
    job.attempts += 1;
    job.started_at = at;
    return job;
  }

  finishJob(
    jobId: string,
    result: { ok: boolean; payload?: unknown; error?: string; retryAfter?: string | null },
  ): void {
    const job = this.jobs.find((row) => row.id === jobId);
    if (!job) return;
    // A retry is the same row put back with a later `run_after`, never a second row for
    // one unit of work.
    if (!result.ok && result.retryAfter) {
      job.status = "queued";
      job.run_after = result.retryAfter;
      job.started_at = null;
      job.error = result.error ?? null;
      job.result = null;
      return;
    }
    job.status = result.ok ? "succeeded" : "failed";
    job.result = result.payload ?? null;
    job.error = result.error ?? null;
    job.finished_at = now();
  }

  getJob(userId: string, jobId: string): ProcessingJobRow | undefined {
    return this.jobs.find((row) => row.id === jobId && row.user_id === userId);
  }
}

/** One store per process; the server and the harness both read this instance. */
export const store = new MemoryStore();

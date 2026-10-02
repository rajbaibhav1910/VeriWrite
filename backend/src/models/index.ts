/**
 * The §38 entities as TypeScript rows, one per table in
 * `src/db/migrations/0001_initial_schema.sql`.
 *
 * These types mirror the SQL column for column, in the database's own snake_case, and
 * nothing here is imported by the browser bundle. The API layer maps a row of these to
 * the camelCase JSON the frontend parses (see `src/schemas/wire.ts`), which keeps the
 * two shapes separate instead of letting one drift into the other.
 *
 * If a column changes here and not in the migration, `npm run typecheck` will not catch
 * it — the contract test in `.scratch/backend-contract.ts` is what catches that class of
 * mistake, by reading a row back through the API.
 */

/** `'user' | 'admin' | 'support'` in SQL. */
export type UserRole = "user" | "admin" | "support";
export type UserStatus = "active" | "suspended" | "deleted";

/** The app's ToolId union; the CHECK constraints in SQL repeat the same nine values. */
export type ToolName =
  | "detector"
  | "paraphraser"
  | "humanizer"
  | "grammar"
  | "plagiarism"
  | "summarizer"
  | "translator"
  | "citations"
  | "writer";

export type AnalysisState = "draft" | "processing" | "completed" | "failed";
export type ClassificationName =
  | "ai_generated"
  | "ai_generated_refined"
  | "human_refined"
  | "human_written";
export type ConfidenceName = "low" | "moderate" | "high" | "very-high";
export type PlanName = "free" | "pro" | "team";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  /** An encoded hash, never a plaintext password. Null for provider-only accounts. */
  password_hash: string | null;
  role: UserRole;
  status: UserStatus;
  locale: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSessionRow {
  id: string;
  user_id: string;
  /** Hash of the presented token; the token itself is not stored. */
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  provider: "local" | "stripe" | "manual";
  plan: PlanName;
  billing_interval: "monthly" | "annual";
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  seats: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  /** Null is the unfiled list, not a missing value. */
  folder_id: string | null;
  title: string;
  body: string;
  tool: ToolName;
  language: string;
  status: AnalysisState;
  word_count: number;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRow {
  id: string;
  document_id: string | null;
  user_id: string;
  tool: ToolName;
  status: AnalysisState;
  language: string;
  ai_probability: number | null;
  classification: ClassificationName | null;
  confidence: ConfidenceName | null;
  word_count: number;
  model_id: string;
  model_version: string;
  /** The engine's full measurement, as the frontend's DetectionResult shape. */
  result: unknown | null;
  error_code: string | null;
  analyzed_at: string;
  created_at: string;
}

export interface SentenceAnalysisRow {
  id: string;
  analysis_id: string;
  ordinal: number;
  text: string;
  /** Offsets into the plain text the model read. */
  start_offset: number;
  end_offset: number;
  ai_probability: number;
  classification: ClassificationName;
  confidence: ConfidenceName;
  signals: unknown[];
  metrics: Record<string, unknown>;
}

export interface ReportRow {
  id: string;
  analysis_id: string | null;
  document_id: string | null;
  user_id: string;
  title: string;
  format: "json" | "pdf" | "html";
  payload: unknown;
  created_at: string;
}

export interface SharedReportRow {
  id: string;
  report_id: string;
  owner_id: string;
  token: string;
  visibility: "link" | "restricted";
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
}

export interface HistoryRow {
  id: string;
  user_id: string;
  document_id: string | null;
  analysis_id: string | null;
  tool: ToolName;
  title: string;
  status: AnalysisState;
  ai_probability: number;
  classification: ClassificationName;
  confidence: ConfidenceName;
  word_count: number;
  /** False when the document behind the row is gone: a summary, not a fake score. */
  result_present: boolean;
  analyzed_at: string;
  created_at: string;
}

export interface UsageCounterRow {
  user_id: string;
  /** `YYYY-MM` in UTC — the same period key the quota guard uses. */
  period: string;
  words: number;
  analyses: number;
  rewrites: number;
  plagiarism: number;
  documents: number;
  updated_at: string;
}

export interface UsageDayRow {
  user_id: string;
  /** `YYYY-MM-DD`. A day with no row recorded nothing; it is not the same as zero. */
  day: string;
  words: number;
  analyses: number;
  rewrites: number;
  plagiarism: number;
}

export interface CitationRow {
  id: string;
  user_id: string;
  document_id: string | null;
  style: "apa" | "mla" | "chicago" | "harvard" | "ieee" | "vancouver";
  source_type:
    | "webpage"
    | "book"
    | "journal"
    | "news"
    | "interview"
    | "software"
    | "report";
  fields: Record<string, unknown>;
  formatted: string;
  /** True only when a lookup actually reached a service. */
  verified: boolean;
  created_at: string;
}

export interface PlagiarismResultRow {
  id: string;
  analysis_id: string | null;
  user_id: string;
  document_id: string | null;
  rank: number;
  source_url: string | null;
  source_title: string;
  snippet: string;
  matched_words: number;
  similarity: number;
  start_offset: number | null;
  end_offset: number | null;
  /** `live` means a real web scan answered. Everything else must be labelled. */
  engine: "live" | "cache" | "demo";
  searched_at: string;
}

export interface ProcessingJobRow {
  id: string;
  user_id: string;
  document_id: string | null;
  kind: "extract" | "detect" | "plagiarism" | "report";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  attempts: number;
  payload: Record<string, unknown>;
  result: unknown | null;
  error: string | null;
  run_after: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface AuditEventRow {
  id: number;
  user_id: string | null;
  action: string;
  subject: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  at: string;
}

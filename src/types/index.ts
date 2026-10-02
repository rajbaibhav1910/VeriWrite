/**
 * Domain types shared by the UI, the service layer and the (future) backend.
 * These mirror the API contract in the product spec (sections 36-38).
 */

export type LanguageCode =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "nl"
  | "zh"
  | "ja"
  | "ko"
  | "ru"
  | "ar"
  | "hi";

export type ConfidenceLevel = "low" | "moderate" | "high" | "very-high";

/** The four non-binary classifications the detector must support. */
export type Classification =
  | "ai_generated"
  | "ai_generated_refined"
  | "human_refined"
  | "human_written";

/** Analysis colour state for a span of text. */
export type SignalKind = "human" | "ai" | "mixed" | "neutral";

/** Model signals are explanatory, never proof of authorship. */
export type SignalName =
  | "predictable_phrasing"
  | "low_sentence_variation"
  | "repetitive_structure"
  | "generic_transition"
  | "uniform_sentence_length"
  | "lexical_diversity"
  | "burstiness"
  | "syntactic_complexity"
  | "hedging_density"
  | "list_bias"
  | "human_marker";

export interface DetectedSignal {
  name: SignalName;
  /** 0-1, how strongly this signal fired for the span. */
  weight: number;
  confidence: ConfidenceLevel;
  /** Plain-English, non-accusatory explanation shown in explanation cards. */
  explanation: string;
}

export interface SentenceAnalysis {
  id: string;
  index: number;
  /** Character offsets into the normalized document text. */
  start: number;
  end: number;
  paragraphIndex: number;
  text: string;
  aiProbability: number;
  humanProbability: number;
  confidence: ConfidenceLevel;
  signal: SignalKind;
  signals: DetectedSignal[];
  wordCount: number;
  characterCount: number;
  syllableEstimate: number;
  flagged: boolean;
}

export interface ParagraphAnalysis {
  index: number;
  text: string;
  aiProbability: number;
  confidence: ConfidenceLevel;
  signal: SignalKind;
  sentenceIndices: number[];
}

export interface DocumentMetrics {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  averageSentenceLength: number;
  sentenceLengthStdDev: number;
  /** Type-token ratio, 0-1. */
  vocabularyDiversity: number;
  /** 0-100 Flesch Reading Ease. */
  readabilityScore: number;
  readabilityLabel: string;
  /** 0-1 relative variation of sentence lengths. */
  burstiness: number;
  readingTimeSeconds: number;
  longestSentence: number;
  uniqueWords: number;
}

/** Percentages across the four classifications; always sums to 100. */
export interface ClassificationBreakdown {
  ai_generated: number;
  ai_generated_refined: number;
  human_refined: number;
  human_written: number;
}

export interface DetectionResult {
  documentId: string;
  analysisId: string;
  /** ISO timestamp. */
  analyzedAt: string;
  language: LanguageCode;
  /** 0-100. Framed as an estimate, never as proof. */
  aiProbability: number;
  humanProbability: number;
  confidence: ConfidenceLevel;
  classification: Classification;
  breakdown: ClassificationBreakdown;
  sentences: SentenceAnalysis[];
  paragraphs: ParagraphAnalysis[];
  metrics: DocumentMetrics;
  signals: DetectedSignal[];
  /** Which engine produced this, so engines stay swappable. */
  engine: string;
  engineVersion: string;
  processingMs: number;
}

export type AnalysisStatus = "draft" | "processing" | "completed" | "failed";

export type ToolId =
  | "detector"
  | "paraphraser"
  | "humanizer"
  | "grammar"
  | "plagiarism"
  | "summarizer"
  | "translator"
  | "citations"
  | "writer";

export interface StoredDocument {
  id: string;
  title: string;
  text: string;
  tool: ToolId;
  language: LanguageCode;
  folderId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  status: AnalysisStatus;
}

export interface HistoryEntry {
  id: string;
  documentId: string;
  title: string;
  tool: ToolId;
  analyzedAt: string;
  wordCount: number;
  aiProbability: number;
  classification: Classification;
  confidence: ConfidenceLevel;
  status: AnalysisStatus;
  /** Kept so an entry can be reopened without a backend. */
  result: DetectionResult | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export type Plan = "free" | "pro" | "team";

export interface UsageCounter {
  tool: ToolId;
  used: number;
  limit: number | null;
  unit: "analyses" | "words" | "pages" | "documents";
}

export interface UserPreferences {
  language: LanguageCode;
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  showConfidence: boolean;
  showExplanations: boolean;
  showSentenceScores: boolean;
  notifications: {
    productUpdates: boolean;
    usageAlerts: boolean;
    weeklySummary: boolean;
  };
  privacy: {
    storeDocuments: boolean;
    improveModels: boolean;
  };
}

export type ThemeMode = "light" | "dark" | "system";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  avatarInitials: string;
  joinedAt: string;
}

/** How a session came to exist: verified by the API service, or created in this browser. */
export type AuthMode = "remote" | "local-demo";

export interface AuthSession {
  user: AuthUser;
  mode: AuthMode;
  issuedAt: string;
  expiresAt: string;
}

export type RequestState<T> =
  | { status: "idle" }
  | { status: "pending"; phase: AnalysisPhase }
  | { status: "success"; data: T }
  | { status: "error"; error: ServiceError };

export type AnalysisPhase =
  | "preparing"
  | "normalizing"
  | "analyzing"
  | "scoring"
  | "reporting";

export interface ServiceError {
  code:
    | "text_too_short"
    | "text_too_long"
    | "invalid_file"
    | "unsupported_file"
    | "unsupported_language"
    | "network"
    | "api"
    | "auth"
    | "timeout"
    | "rate_limited"
    | "unknown";
  message: string;
  /** Actionable next step shown to the user. */
  hint?: string;
}

export type IssueCategory =
  | "grammar"
  | "spelling"
  | "punctuation"
  | "clarity"
  | "style";

/** What the reader has decided to do about a finding. */
export type GrammarIssueState = "open" | "accepted" | "ignored";

export interface GrammarIssue {
  id: string;
  category: IssueCategory;
  start: number;
  end: number;
  original: string;
  suggestion: string;
  explanation: string;
  confidence: ConfidenceLevel;
  state: GrammarIssueState;
}

export interface PlagiarismSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
  similarity: number;
  matchedText: string;
  publishedAt?: string;
}

export interface PlagiarismResult {
  documentId: string;
  originality: number;
  matchedPercentage: number;
  sources: PlagiarismSource[];
  scannedAt: string;
  /** Always true for the bundled engine; the UI must surface it. */
  demo: boolean;
}

export interface Citation {
  id: string;
  style: CitationStyle;
  sourceType: CitationSourceType;
  formatted: string;
  bibliographyEntry: string;
  inText: string;
  fields: Record<string, string>;
}

export type CitationStyle = "apa" | "mla" | "chicago" | "harvard" | "ieee";

export type CitationSourceType =
  | "webpage"
  | "book"
  | "journal"
  | "news"
  | "manual";

export interface ParaphraseOptions {
  mode: ParaphraseMode;
  tone: string;
  synonymLevel: number;
  language: LanguageCode;
  /**
   * Bumped by "Rewrite" to ask the rewriter for a different pass over the same
   * text. Left out for the first run.
   */
  variant?: number;
}

export type ParaphraseMode =
  | "standard"
  | "fluency"
  | "formal"
  | "academic"
  | "simple"
  | "creative"
  | "professional";

export interface ParaphraseResult {
  output: string;
  changedWords: number;
  similarity: number;
  mode: ParaphraseMode;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  keywords: string[];
  format: "paragraph" | "bullets" | "key-points";
  compressionRatio: number;
}

export interface AssistantAction {
  id: string;
  label: string;
  description: string;
}

import type { AnalysisPhase, GrammarIssue, IssueCategory } from "@/types";
import { apiRequest, backendConfigured } from "@/lib/api";
import {
  PHASE_PAUSE_MS,
  assertTextLength,
  requireRecord,
  sleep,
  throwIfAborted,
} from "@/lib/service";
import {
  GRAMMAR_RULE_COUNT,
  applyFixes,
  checkGrammar as runGrammarEngine,
} from "@/lib/tools/grammarEngine";

export const GRAMMAR_CATEGORIES: IssueCategory[] = [
  "grammar",
  "spelling",
  "punctuation",
  "clarity",
  "style",
];

/** A single word is enough for the rules to judge, unlike the statistical engines. */
export const GRAMMAR_MIN_WORDS = 1;

/**
 * What this checker is, in the words the page shows. The rules are patterns over
 * English text, so the copy must not promise the judgement of a human editor.
 */
export const GRAMMAR_NOTE =
  "This is a rule-based checker running in this browser: it matches written patterns, so it can miss a real mistake and can flag wording that is deliberate. It checks English prose only. Read each explanation before accepting a change, and treat an empty report as \"no pattern matched\", not as \"error free\".";

export interface GrammarReport {
  issues: GrammarIssue[];
  counts: Record<IssueCategory, number>;
  wordsChecked: number;
}

export interface GrammarRunOptions {
  signal?: AbortSignal;
  onPhase?: (phase: AnalysisPhase) => void;
  /** Limit the pass to specific categories; all of them by default. */
  categories?: IssueCategory[];
}

function emptyCounts(): Record<IssueCategory, number> {
  return { grammar: 0, spelling: 0, punctuation: 0, clarity: 0, style: 0 };
}

export function summariseIssues(issues: GrammarIssue[]): Record<IssueCategory, number> {
  const counts = emptyCounts();
  for (const issue of issues) counts[issue.category] += 1;
  return counts;
}

const CONFIDENCES = ["low", "moderate", "high", "very-high"] as const;
const STATES = ["open", "accepted", "ignored"] as const;

/** A remote response is only trusted as far as its fields check out. */
export function guardGrammarIssue(value: unknown, index: number): GrammarIssue {
  const record = requireRecord(value, "grammar");
  const original = typeof record.original === "string" ? record.original : "";
  return {
    id: typeof record.id === "string" ? record.id : `issue_remote_${index}`,
    category: GRAMMAR_CATEGORIES.includes(record.category as IssueCategory)
      ? (record.category as IssueCategory)
      : "style",
    start: typeof record.start === "number" ? record.start : 0,
    end: typeof record.end === "number" ? record.end : 0,
    original,
    suggestion: typeof record.suggestion === "string" ? record.suggestion : original,
    explanation: typeof record.explanation === "string" ? record.explanation : "",
    confidence: CONFIDENCES.includes(record.confidence as (typeof CONFIDENCES)[number])
      ? (record.confidence as GrammarIssue["confidence"])
      : "moderate",
    state: STATES.includes(record.state as (typeof STATES)[number])
      ? (record.state as GrammarIssue["state"])
      : "open",
  };
}

function toReport(issues: GrammarIssue[], wordsChecked: number): GrammarReport {
  return { issues, counts: summariseIssues(issues), wordsChecked };
}

async function grammarRemotely(text: string, options: GrammarRunOptions): Promise<GrammarReport> {
  const payload = await apiRequest<unknown>("/api/grammar", {
    method: "POST",
    body: { text, categories: options.categories },
    signal: options.signal,
  });
  const record = requireRecord(payload, "grammar");
  const issues = Array.isArray(record.issues)
    ? record.issues.map((issue, index) => guardGrammarIssue(issue, index))
    : [];
  const words =
    typeof record.wordsChecked === "number" ? record.wordsChecked : undefined;
  return toReport(issues, words ?? 0);
}

async function grammarLocally(text: string, options: GrammarRunOptions): Promise<GrammarReport> {
  const { signal, onPhase, categories } = options;
  throwIfAborted(signal, "That check");
  onPhase?.("preparing");
  const words = assertTextLength(text, "The grammar checker", 1);
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That check");
  onPhase?.("analyzing");
  await sleep(PHASE_PAUSE_MS);
  const found = runGrammarEngine(text);

  onPhase?.("reporting");
  await sleep(PHASE_PAUSE_MS / 2);
  const filtered = categories?.length
    ? found.filter((issue) => categories.includes(issue.category))
    : found;
  return toReport(filtered, words);
}

export async function checkGrammarText(
  text: string,
  options: GrammarRunOptions = {},
): Promise<GrammarReport> {
  return backendConfigured() ? grammarRemotely(text, options) : grammarLocally(text, options);
}

/** Applies the suggestions of the issues passed in; ignored and stale ranges are skipped. */
export function applyGrammarFixes(text: string, issues: GrammarIssue[]): string {
  return applyFixes(text, issues);
}

export const GRAMMAR_ENGINE_INFO = {
  ruleCount: GRAMMAR_RULE_COUNT,
  categories: GRAMMAR_CATEGORIES,
  runsLocally: !backendConfigured(),
};

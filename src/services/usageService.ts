import type { Plan, ServiceError, ToolId, UsageCounter } from "@/types";
import { PLANS } from "@/config/plans";
import { apiRequest, backendConfigured } from "@/lib/api";
import { optionalNumber, requireRecord } from "@/lib/service";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { listDocuments } from "@/services/documentService";

/** What a plan is measured against. `words` is a monthly pool shared by every tool. */
export type UsageMetric = "analyses" | "words" | "documents";

export interface UsageDay {
  words: number;
  analyses: number;
  rewrites: number;
  plagiarism: number;
}

export interface UsagePeriod {
  /** "2026-09" style key; a stored period that is not the current one is discarded. */
  period: string;
  counts: Record<string, number>;
  /** Per-day totals, keyed "2026-09-30", kept so the dashboard can draw a trend. */
  days: Record<string, UsageDay>;
}

/** Tools that share the rewrite allowance rather than the detection allowance. */
const REWRITE_TOOLS: ToolId[] = [
  "paraphraser",
  "humanizer",
  "grammar",
  "writer",
  "summarizer",
  "translator",
  "citations",
];

/**
 * Limits are parsed out of the published plan table rather than restated here, so a
 * price page and the quota check cannot drift apart.
 */
function quotaNumber(plan: Plan, label: string): number | null {
  const definition = PLANS.find((entry) => entry.id === plan);
  const raw = definition?.quotas.find((row) => row.label === label)?.value ?? "";
  if (!raw || /unlimited|not included|^—$/iu.test(raw.trim())) {
    return /not included/iu.test(raw) ? 0 : null;
  }
  const parsed = Number(raw.replace(/[^0-9.]/gu, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export const PLAN_LIMITS: Record<Plan, Record<UsageMetric, number | null>> = {
  free: {
    analyses: quotaNumber("free", "AI detection analyses"),
    words: quotaNumber("free", "Words processed per month"),
    documents: quotaNumber("free", "Saved documents"),
  },
  pro: {
    analyses: quotaNumber("pro", "AI detection analyses"),
    words: quotaNumber("pro", "Words processed per month"),
    documents: quotaNumber("pro", "Saved documents"),
  },
  team: {
    analyses: quotaNumber("team", "AI detection analyses"),
    words: quotaNumber("team", "Words processed per month"),
    documents: quotaNumber("team", "Saved documents"),
  },
};

export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The day a run belongs to, in UTC, matching how `currentPeriod` rolls over. */
export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function emptyDay(): UsageDay {
  return { words: 0, analyses: 0, rewrites: 0, plagiarism: 0 };
}

function load(): UsagePeriod {
  const stored = readJson<Partial<UsagePeriod>>(STORAGE_KEYS.usage, {});
  const period = currentPeriod();
  // A counter kept for a previous month is history, not a balance to carry over.
  if (stored.period !== period) return { period, counts: {}, days: {} };
  const counts = stored.counts && typeof stored.counts === "object" ? stored.counts : {};
  const rawDays = stored.days && typeof stored.days === "object" ? stored.days : {};
  const days: Record<string, UsageDay> = {};
  for (const [key, value] of Object.entries(rawDays)) {
    if (!value || typeof value !== "object") continue;
    const day = value as Partial<UsageDay>;
    days[key] = {
      words: numberOrZero(day.words),
      analyses: numberOrZero(day.analyses),
      rewrites: numberOrZero(day.rewrites),
      plagiarism: numberOrZero(day.plagiarism),
    };
  }
  return { period, counts, days };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export interface UsageLine {
  id: "detection" | "words" | "rewrites" | "plagiarism" | "documents";
  label: string;
  tool: ToolId;
  unit: UsageCounter["unit"];
  used: number;
  limit: number | null;
}

/**
 * The counters a page is drawn from: the device's own unless a service reported them.
 * The `limit` column always comes from `PLAN_LIMITS`, which is parsed out of the
 * published plan table, so a remote payload can move a number but not a price.
 */
export function getUsage(plan: Plan, counters?: Record<string, number>): UsageLine[] {
  const counts = counters ?? load().counts;
  const limits = PLAN_LIMITS[plan];
  return [
    {
      id: "detection",
      label: "AI detection analyses",
      tool: "detector",
      unit: "analyses",
      used: counts.analyses ?? 0,
      limit: limits.analyses,
    },
    {
      id: "words",
      label: "Words processed",
      tool: "detector",
      unit: "words",
      used: counts.words ?? 0,
      limit: limits.words,
    },
    {
      id: "rewrites",
      label: "Rewrite runs",
      tool: "paraphraser",
      unit: "analyses",
      used: counts.rewrites ?? 0,
      limit: quotaNumber(plan, "Paraphrasing runs"),
    },
    {
      id: "plagiarism",
      label: "Plagiarism scans",
      tool: "plagiarism",
      unit: "analyses",
      used: counts.plagiarism ?? 0,
      limit: quotaNumber(plan, "Plagiarism scans"),
    },
    {
      id: "documents",
      label: "Saved documents",
      tool: "detector",
      unit: "documents",
      // A service that counts the library reports the number; otherwise it is what
      // this device holds, which is the count the documents line has always shown.
      used: counts.documents ?? listDocuments().length,
      limit: limits.documents,
    },
  ];
}

export interface QuotaCheck {
  allowed: boolean;
  metric: UsageMetric | null;
  used: number;
  limit: number | null;
  remaining: number | null;
  /** Shown when a run is blocked, so the message names the limit that stopped it. */
  reason?: string;
}

/** Pure check: nothing is written until `recordUsage` runs after a successful pass. */
export function canRun(
  plan: Plan,
  tool: ToolId,
  words = 0,
): QuotaCheck {
  const { counts } = load();
  const limits = PLAN_LIMITS[plan];

  const wordLimit = limits.words;
  const wordUsed = counts.words ?? 0;
  if (wordLimit !== null && wordUsed + words > wordLimit) {
    return {
      allowed: false,
      metric: "words",
      used: wordUsed,
      limit: wordLimit,
      remaining: Math.max(0, wordLimit - wordUsed),
      reason: `Your ${plan} plan processes ${wordLimit.toLocaleString("en-US")} words a month. This run needs ${words.toLocaleString("en-US")}.`,
    };
  }

  if (tool === "detector") {
    const limit = limits.analyses;
    const used = counts.analyses ?? 0;
    if (limit !== null && used >= limit) {
      return {
        allowed: false,
        metric: "analyses",
        used,
        limit,
        remaining: 0,
        reason: `Your ${plan} plan includes ${limit} detection ${limit === 1 ? "analysis" : "analyses"} a month. You have used them all.`,
      };
    }
    return { allowed: true, metric: "analyses", used, limit, remaining: limit === null ? null : limit - used };
  }

  if (tool === "plagiarism") {
    const limit = quotaNumber(plan, "Plagiarism scans");
    const used = counts.plagiarism ?? 0;
    if (limit !== null && limit === 0) {
      return {
        allowed: false,
        metric: "analyses",
        used,
        limit,
        remaining: 0,
        reason: "Source matching is not part of the free plan.",
      };
    }
    if (limit !== null && used >= limit) {
      return {
        allowed: false,
        metric: "analyses",
        used,
        limit,
        remaining: 0,
        reason: `Your ${plan} plan includes ${limit} plagiarism scans a month.`,
      };
    }
  }

  return { allowed: true, metric: null, used: wordUsed, limit: wordLimit, remaining: wordLimit === null ? null : wordLimit - wordUsed };
}

/** Days of history the dashboard draws, and the most the counter is allowed to keep. */
export const SERIES_DAYS = 14;
const DAY_RETENTION = 62;

/**
 * A blocked run is reported as the refusal it is: the limit that stopped it, and where
 * to read the plan. Nothing is quietly trimmed to fit.
 */
export function quotaError(check: QuotaCheck): ServiceError {
  return {
    code: "rate_limited",
    message: check.reason ?? "That run is over your plan's limit.",
    hint: "Read the counters on the Usage page, or see what a higher plan includes.",
  };
}

export function recordUsage(tool: ToolId, words: number): UsagePeriod {
  const next = load();
  const counts = { ...next.counts };
  const added = Math.max(0, Math.round(words));
  counts.words = (counts.words ?? 0) + added;
  const touched: (keyof UsageDay)[] = [];
  if (tool === "detector") {
    counts.analyses = (counts.analyses ?? 0) + 1;
    touched.push("analyses");
  }
  if (tool === "plagiarism") {
    counts.plagiarism = (counts.plagiarism ?? 0) + 1;
    touched.push("plagiarism");
  }
  if (REWRITE_TOOLS.includes(tool)) {
    counts.rewrites = (counts.rewrites ?? 0) + 1;
    touched.push("rewrites");
  }

  const today = dayKey();
  const days = { ...next.days };
  const day = days[today] ?? emptyDay();
  days[today] = { ...day, words: day.words + added };
  for (const metric of touched) days[today] = { ...days[today], [metric]: days[today][metric] + 1 };

  // Two months of days is plenty for a fortnight of chart; older keys are dropped.
  const kept = Object.keys(days)
    .sort()
    .slice(-DAY_RETENTION);
  const trimmed: Record<string, UsageDay> = {};
  for (const key of kept) trimmed[key] = days[key];

  const period: UsagePeriod = { period: next.period, counts, days: trimmed };
  writeJson(STORAGE_KEYS.usage, period);
  return period;
}

export interface UsagePoint {
  day: string;
  label: string;
  words: number;
  analyses: number;
  rewrites: number;
  plagiarism: number;
  /** True for the days this build actually has a counter for. */
  recorded: boolean;
}

/**
 * The last `span` days, including the empty ones: a gap is drawn as a gap, because a
 * chart that only lists days with activity makes a quiet week look like a trend.
 */
export function usageSeries(span = SERIES_DAYS, date = new Date()): UsagePoint[] {
  return buildSeries(load().days, span, date);
}

/** The same window over whichever day map is in front of it — device counters or service rows. */
function buildSeries(days: Record<string, UsageDay>, span: number, date: Date): UsagePoint[] {
  const points: UsagePoint[] = [];
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const at = new Date(date.getTime() - offset * 86_400_000);
    const key = dayKey(at);
    const entry = days[key];
    points.push({
      day: key,
      label: at.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      words: entry?.words ?? 0,
      analyses: entry?.analyses ?? 0,
      rewrites: entry?.rewrites ?? 0,
      plagiarism: entry?.plagiarism ?? 0,
      recorded: entry !== undefined,
    });
  }
  return points;
}

export interface OverviewCard {
  id: "words" | "documents" | "scans" | "improvements";
  label: string;
  value: number;
  /** Where the number comes from, printed under it so nothing looks conjured. */
  source: string;
  to: string;
}

/** The four dashboard figures, each read from the counters or the library it names. */
export function getOverview(counters?: Record<string, number>): OverviewCard[] {
  const counts = counters ?? load().counts;
  // Where a number came from is printed under it, so a service count and a device
  // count never look like the same kind of fact.
  const counted = counters
    ? "counted by the service this month"
    : `measured this month (${currentPeriod()})`;
  const documentsCounted =
    counters && counts.documents !== undefined
      ? "counted by the service"
      : "stored on this device";
  return [
    {
      id: "words",
      label: "Words analyzed",
      value: counts.words ?? 0,
      source: counted,
      to: "/usage",
    },
    {
      id: "documents",
      label: "Documents",
      value: counts.documents ?? listDocuments().length,
      source: documentsCounted,
      to: "/documents",
    },
    {
      id: "scans",
      label: "AI scans",
      value: counts.analyses ?? 0,
      source: "detection runs this month",
      to: "/history",
    },
    {
      id: "improvements",
      label: "Writing improvements",
      value: counts.rewrites ?? 0,
      source: "rewrite, grammar, summary and assistant runs this month",
      to: "/usage",
    },
  ];
}

export function usagePercent(line: UsageLine): number {
  if (line.limit === null || line.limit === 0) return 0;
  return Math.min(100, Math.round((line.used / line.limit) * 100));
}

/** First day of next month, UTC — the date the counters roll over. */
export function monthlyResetDate(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export function formatResetCountdown(date = new Date()): string {
  const reset = monthlyResetDate(date);
  const days = Math.max(0, Math.ceil((reset.getTime() - date.getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

/* ---------------------------------------------------------------- remote counters */

/** Which set of numbers the usage page is drawing. Printed on the page, never assumed. */
export type UsageSource = "this browser's counters" | "api service";

export interface UsageCapabilities {
  source: UsageSource;
  backendConfigured: boolean;
  note: string;
}

export function getUsageCapabilities(): UsageCapabilities {
  return backendConfigured()
    ? {
        source: "api service",
        backendConfigured: true,
        note: "The counters come from GET /api/usage on the attached service. The limits beside them are the published plan table, and a run is still refused here before it is sent.",
      }
    : {
        source: "this browser's counters",
        backendConfigured: false,
        note: "No analysis service is attached to this build, so these counters are the only accounting that exists: they are kept on this device and reset when the month rolls over.",
      };
}

export interface UsageSnapshot {
  source: UsageSource;
  /** The period the counters belong to, e.g. "2026-10". */
  period: string;
  resetsAt: string;
  lines: UsageLine[];
  overview: OverviewCard[];
  series: UsagePoint[];
}

function parseCounters(payload: Record<string, unknown>): Record<string, number> {
  const raw = requireRecord(payload.counts ?? payload.counters ?? {}, "usage");
  const counters: Record<string, number> = {
    words: optionalNumber(raw, "words"),
    analyses: optionalNumber(raw, "analyses"),
    rewrites: optionalNumber(raw, "rewrites"),
    plagiarism: optionalNumber(raw, "plagiarism"),
  };
  // The library count is only taken from the service when it actually reports one.
  if (typeof raw.documents === "number" && Number.isFinite(raw.documents)) {
    counters.documents = raw.documents;
  }
  return counters;
}

/** Service rows are untrusted: a malformed day is skipped, and a skipped day is a gap. */
function parseRemoteDays(payload: unknown): Record<string, UsageDay> {
  const days: Record<string, UsageDay> = {};
  if (!Array.isArray(payload)) return days;
  for (const row of payload) {
    if (typeof row !== "object" || row === null) continue;
    const entry = row as Record<string, unknown>;
    if (typeof entry.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(entry.day)) continue;
    days[entry.day] = {
      words: optionalNumber(entry, "words"),
      analyses: optionalNumber(entry, "analyses"),
      rewrites: optionalNumber(entry, "rewrites"),
      plagiarism: optionalNumber(entry, "plagiarism"),
    };
  }
  return days;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** The device's own numbers, with no promise around them: this is what a local build shows. */
export function usageSnapshotLocal(plan: Plan, span = SERIES_DAYS): UsageSnapshot {
  const period = load();
  return {
    source: "this browser's counters",
    period: period.period,
    resetsAt: monthlyResetDate().toISOString(),
    lines: getUsage(plan),
    overview: getOverview(),
    series: usageSeries(span),
  };
}

/**
 * Everything the usage page and the dashboard draw, from the service when one is
 * attached and from this device when it is not. The local branch is the synchronous
 * store, so a build without a backend renders exactly what it rendered before.
 */
export async function getUsageSnapshot(plan: Plan, span = SERIES_DAYS): Promise<UsageSnapshot> {
  if (!backendConfigured()) return usageSnapshotLocal(plan, span);

  const payload = requireRecord(await apiRequest<unknown>("/api/usage"), "usage");
  const counters = parseCounters(payload);
  const seriesSpan = Math.max(1, Math.min(span, SERIES_DAYS));
  return {
    source: "api service",
    period: typeof payload.period === "string" ? payload.period : currentPeriod(),
    resetsAt: isoDate(payload.resetsAt) ?? monthlyResetDate().toISOString(),
    lines: getUsage(plan, counters),
    overview: getOverview(counters),
    series: buildSeries(parseRemoteDays(payload.days), seriesSpan, new Date()),
  };
}

/** `resetsAt` from the snapshot, spoken the way the badge has always spoken it. */
export function formatResetFrom(iso: string, now = new Date()): { date: string; countdown: string } {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return {
      date: monthlyResetDate(now).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
      countdown: formatResetCountdown(now),
    };
  }
  const days = Math.max(0, Math.ceil((at.getTime() - now.getTime()) / 86_400_000));
  return {
    date: at.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
    countdown: days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`,
  };
}

/**
 * Usage counters: the month's totals and the per-day buckets the chart draws.
 *
 * Two facts live here and they are not the same fact. `usage_counters` counts what was
 * *done* during a period — words analysed, runs taken. The "Saved documents" figure the
 * usage page shows is a *library size*, read from `documents` at the moment of the
 * request. Reporting the month's creations under that label would be a different number
 * wearing a name the client already prints, so the wire carries the size and the counter
 * keeps its own meaning.
 */
import { store } from "../store/memory.ts";
import { type UsageWire, usageToWire } from "../schemas/wire.ts";

/** `YYYY-MM`, UTC — the same key `usageService.currentPeriod` builds in the browser. */
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The day a run belongs to, in UTC, matching how the period rolls over. */
export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The first instant of next month, which is when the counters start again. */
export function resetsAt(date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return next.toISOString();
}

export function getUsage(userId: string, period = currentPeriod()): UsageWire {
  const counter = store.usageCounter(userId, period) ?? null;
  // The buckets of the requested month only; a chart of the last 30 days reads the days
  // that exist and draws a gap for the rest.
  const days = store.daysIn(userId, [period]);
  const documents = store.listDocuments(userId).length;
  const wire = usageToWire(counter, days, period, resetsAt());
  return { ...wire, counters: { ...wire.counters, documents } };
}

/**
 * What one finished run adds: the words it measured and one analysis. The rewrite and
 * plagiarism counters move as well, because the plans limit them separately.
 */
export function recordRunUsage(userId: string, tool: string, words: number): void {
  store.recordUsage(userId, currentPeriod(), dayKey(), {
    words,
    analyses: 1,
    ...(tool === "paraphraser" || tool === "humanizer" || tool === "grammar"
      ? { rewrites: 1 }
      : {}),
    ...(tool === "plagiarism" ? { plagiarism: 1 } : {}),
  });
}

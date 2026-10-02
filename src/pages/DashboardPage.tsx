import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Gauge, Files, ScanLine, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsageChart } from "@/components/charts/UsageChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { TOOLS, TOOL_NAME } from "@/config/navigation";
import { CLASSIFICATION_LABEL, formatNumber, formatRelativeTime } from "@/lib/utils";
import { formatResetFrom } from "@/services/usageService";
import { useHistoryRows } from "@/hooks/useLibrary";
import { useUsageSnapshot } from "@/hooks/useUsageSnapshot";
import type { HistoryFilter } from "@/services/documentService";
import { useAuthSession } from "@/store/authStore";
import type { OverviewCard } from "@/services/usageService";
import type { UsageSource } from "@/services/usageService";
import type { ToolId } from "@/types";

/** The five actions the product asks a returning writer to take first. */
const QUICK_ACTIONS: ToolId[] = ["detector", "paraphraser", "grammar", "humanizer", "plagiarism"];

const CARD_ICONS = {
  words: Gauge,
  documents: Files,
  scans: ScanLine,
  improvements: Wand2,
} as const;

/** Where the counters on this page were read from, in the words the page prints. */
function counterNote(source: UsageSource | undefined): string {
  return source === "api service" ? "Counted by the attached service." : "Counted on this device.";
}

function counterPhrase(source: UsageSource | undefined): string {
  return source === "api service" ? "the service has counted" : "this device has recorded";
}

export function DashboardPage() {
  const session = useAuthSession();
  const plan = session?.user.plan ?? "free";
  const { status, snapshot, error, reload } = useUsageSnapshot(plan);
  const overview = snapshot?.overview ?? [];
  const points = snapshot?.series ?? [];
  // The six newest saved analyses, wherever the library keeps them.
  const recentFilters = useMemo<HistoryFilter>(() => ({ page: 1, pageSize: 6, sort: "newest" }), []);
  const recentRows = useHistoryRows(recentFilters);
  const recent = recentRows.page?.entries ?? [];
  const storedTotal = recentRows.page?.total ?? 0;
  const busiestDay = points.reduce((best, point) => (point.words > best.words ? point : best), points[0]);
  const measured = points.some((point) => point.recorded);
  const reset = formatResetFrom(snapshot?.resetsAt ?? "");

  return (
    <>
      <PageHeader
        title={greeting(new Date())}
        description={
          session
            ? `${session.user.name.split(" ")[0]} — here is what ${counterPhrase(snapshot?.source)} for the ${session.user.plan} plan.`
            : `Here is what ${counterPhrase(snapshot?.source)}.`
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/usage">
                <CalendarClock className="size-3.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">Usage</span>
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/detector">
                <Gauge className="size-3.5" aria-hidden />
                Analyze text
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {status === "loading" ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-surface-sunken px-4 py-2.5 text-2xs text-muted-foreground"
          >
            Reading the counters from the attached service.
          </p>
        ) : null}

        {status === "error" && error ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-error/30 bg-error-soft px-4 py-3 text-2xs text-error">
            <span className="min-w-0 flex-1">
              {error.message}
              {error.hint ? ` ${error.hint}` : null}
            </span>
            <Button variant="outline" size="sm" onClick={reload}>
              Try again
            </Button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overview.map((card) => (
            <OverviewTile key={card.id} card={card} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <UsageChart points={points} />

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {recentRows.status === "loading" && recent.length === 0 ? (
                  <p role="status" className="text-2xs text-muted-foreground">
                    Reading your saved analyses…
                  </p>
                ) : recent.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Gauge}
                    title="No analyses yet"
                    description="Your previous detection reports will appear here."
                    action={
                      <Button asChild size="sm">
                        <Link to="/detector">Analyze your first document</Link>
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <ul className="divide-y divide-border">
                      {recent.map((entry) => (
                        <li key={entry.id} className="flex items-center gap-3 py-2">
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/detector?analysis=${encodeURIComponent(entry.id)}`}
                              className="block truncate text-2xs font-medium hover:underline"
                            >
                              {entry.title}
                            </Link>
                            <p className="mt-0.5 truncate text-3xs text-muted-foreground">
                              {TOOL_NAME[entry.tool]} · {formatNumber(entry.wordCount)} words ·{" "}
                              {formatRelativeTime(entry.analyzedAt)}
                            </p>
                          </div>
                          <Badge variant="subtle" size="sm">
                            {CLASSIFICATION_LABEL[entry.classification]}
                          </Badge>
                          <Link
                            to={`/report?a=${encodeURIComponent(entry.id)}`}
                            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Open the report for ${entry.title}`}
                          >
                            <ArrowRight className="size-4" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-3xs text-muted-foreground">
                        Showing {recent.length} of {storedTotal} stored {storedTotal === 1 ? "run" : "runs"}.
                      </p>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/history">All history</Link>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-xs font-semibold tracking-tight">Quick actions</h2>
              <ul className="mt-2 space-y-1.5">
                {QUICK_ACTIONS.map((tool) => {
                  const meta = TOOLS.find((entry) => entry.tool === tool);
                  if (!meta) return null;
                  return (
                    <li key={tool}>
                      <Link
                        to={meta.path}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-2xs font-medium transition-colors hover:border-primary/45 hover:bg-surface-sunken"
                      >
                        {meta.name}
                        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="p-4">
              <h2 className="text-xs font-semibold tracking-tight">This month</h2>
              <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                {measured
                  ? `Busiest day ${busiestDay?.label ?? ""}, with ${formatNumber(busiestDay?.words ?? 0)} words processed.`
                  : "Nothing has been recorded on this device yet, so there is no trend to draw."}
              </p>
              <div className="mt-2 space-y-2">
                {overview.slice(0, 2).map((card) => (
                  <div key={`bar-${card.id}`}>
                    <div className="flex items-baseline justify-between text-3xs text-muted-foreground">
                      <span>{card.label}</span>
                      <span>{formatNumber(card.value)}</span>
                    </div>
                    <Progress
                      value={card.id === "words" ? Math.min(100, Math.round((card.value / 5000) * 100)) : Math.min(100, card.value * 5)}
                      aria-label={`${card.label} against the free plan allowance`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-3xs leading-relaxed text-muted-foreground">
                {counterNote(snapshot?.source)} Counters reset {reset.countdown} (
                {reset.date}).{" "}
                <Link to="/usage" className="underline underline-offset-2">
                  See all limits
                </Link>
              </p>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function OverviewTile({ card }: { card: OverviewCard }) {
  const Icon = CARD_ICONS[card.id];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(card.value)}</p>
      <p className="mt-0.5 text-3xs text-muted-foreground">{card.source}</p>
      <Link
        to={card.to}
        className="mt-2 inline-flex items-center gap-1 text-3xs font-medium text-primary hover:underline"
      >
        Details
        <ArrowRight className="size-3" aria-hidden />
      </Link>
    </Card>
  );
}

/** The spec's header is a greeting; it says the time of day it was written at. */
function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

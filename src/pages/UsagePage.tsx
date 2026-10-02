import { Link } from "react-router-dom";
import { CalendarClock, Info, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TOOL_NAME } from "@/config/navigation";
import { PLANS } from "@/config/plans";
import { formatNumber } from "@/lib/utils";
import {
  formatResetFrom,
  getUsageCapabilities,
  usagePercent,
} from "@/services/usageService";
import { useUsageSnapshot } from "@/hooks/useUsageSnapshot";
import { useAuthSession } from "@/store/authStore";
import type { Plan } from "@/types";

export function UsagePage() {
  const session = useAuthSession();
  const plan: Plan = session?.user.plan ?? "free";
  const { status, snapshot, error, reload } = useUsageSnapshot(plan);
  const lines = snapshot?.lines ?? [];
  const definition = PLANS.find((entry) => entry.id === plan);
  const capabilities = getUsageCapabilities();
  const reset = formatResetFrom(snapshot?.resetsAt ?? "");

  return (
    <>
      <PageHeader
        title="Usage"
        description={`What the ${plan} plan has allowed this month, and what is left.`}
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Usage" }]}
        actions={
          <>
            <Badge variant="outline" size="sm">
              <CalendarClock className="size-3" aria-hidden />
              Resets {reset.date} ({reset.countdown})
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link to="/pricing">Compare plans</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {status === "loading" ? (
            <p
              role="status"
              className="rounded-lg border border-border bg-surface-sunken px-4 py-2.5 text-2xs text-muted-foreground"
            >
              Reading this month's counters from the attached service.
            </p>
          ) : null}

          {status === "error" && error ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-error/30 bg-error-soft px-4 py-3 text-2xs text-error">
              <span className="min-w-0 flex-1">
                {error.message}
                {error.hint ? ` ${error.hint}` : ""} The counters below are not shown rather than guessed at.
              </span>
              <Button variant="outline" size="sm" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : null}

          {lines.map((line) => {
            const percent = usagePercent(line);
            const spent = line.limit !== null && line.used >= line.limit;
            return (
              <Card key={line.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold tracking-tight">{line.label}</h2>
                  <p className="text-2xs tabular-nums text-muted-foreground">
                    {formatNumber(line.used)}{" "}
                    {line.limit === null ? (
                      <span>
                        {" "}
                        / no limit on the {plan} plan
                      </span>
                    ) : line.limit === 0 ? (
                      <span className="text-warning">· not included in the {plan} plan</span>
                    ) : (
                      <span>/ {formatNumber(line.limit)} {line.unit}</span>
                    )}
                  </p>
                </div>
                <Progress
                  className="mt-2"
                  value={line.limit === null || line.limit === 0 ? 0 : percent}
                  indicatorClassName={spent ? "bg-warning" : undefined}
                  aria-label={`${line.label}: ${line.used} of ${line.limit ?? "no limit"}`}
                />
                <p className="mt-1.5 text-3xs leading-relaxed text-muted-foreground">
                  {line.limit === null
                    ? `Unlimited on this plan. ${TOOL_NAME[line.tool]} is where the runs are made.`
                    : line.limit === 0
                      ? `${TOOL_NAME[line.tool]} is not part of the ${plan} plan. A higher plan lists it as included.`
                      : spent
                        ? `All ${formatNumber(line.limit)} ${line.unit} are used. Runs in ${TOOL_NAME[line.tool]} are refused until the reset on ${reset.date}.`
                        : `${formatNumber(line.limit - line.used)} ${line.unit} left, ${percent}% used.`}
                </p>
              </Card>
            );
          })}

          <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-2xs leading-relaxed text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {capabilities.note}
          </p>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Wallet className="size-4 text-primary" aria-hidden />
                Current plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs font-semibold tracking-tight">
                {definition?.name ?? "Free"}{" "}
                <span className="text-2xs font-normal text-muted-foreground">
                  ({definition?.monthly === 0 ? "no card required" : `$${definition?.monthly ?? 0} a month`})
                </span>
              </p>
              <p className="text-2xs leading-relaxed text-muted-foreground">{definition?.audience}</p>
              <ul className="space-y-1">
                {(definition?.quotas ?? []).slice(0, 4).map((row) => (
                  <li key={row.label} className="flex items-baseline justify-between gap-2 text-2xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="tabular-nums">{row.value}</span>
                  </li>
                ))}
              </ul>
              {!session ? (
                <p className="text-3xs leading-relaxed text-muted-foreground">
                  Nobody is signed in, so the free plan is what these limits describe.{" "}
                  <Link to="/signup" className="underline underline-offset-2">
                    Create an account
                  </Link>{" "}
                  to attach the counters to a plan.
                </p>
              ) : null}
              <Button asChild size="sm" className="w-full">
                <Link to="/pricing">Change plan</Link>
              </Button>
              <p className="text-3xs leading-relaxed text-muted-foreground">
                Changing plans needs the billing service; this build does not take payment in the browser.
              </p>
            </CardContent>
          </Card>

          <Card className="p-4">
            <h2 className="text-xs font-semibold tracking-tight">Where the runs are made</h2>
            <ul className="mt-2 space-y-1.5">
              {["detector", "paraphraser", "plagiarism"].map((tool) => (
                <li key={tool}>
                  <Link
                    to={`/${tool}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-2xs transition-colors hover:border-primary/45 hover:bg-surface-sunken"
                  >
                    {TOOL_NAME[tool as keyof typeof TOOL_NAME]}
                    <span className="text-muted-foreground">open</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

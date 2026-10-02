import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import type { UsagePoint } from "@/services/usageService";

type Metric = "words" | "analyses" | "rewrites" | "plagiarism";

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "words", label: "Words processed", unit: "words" },
  { id: "analyses", label: "AI scans", unit: "scans" },
  { id: "rewrites", label: "Rewrite runs", unit: "runs" },
  { id: "plagiarism", label: "Plagiarism scans", unit: "scans" },
];

const HEIGHT = 108;

export interface UsageChartProps {
  points: UsagePoint[];
  className?: string;
}

/**
 * A plain SVG bar chart rather than a charting library: the dashboard loads on every
 * signed-in visit, and fourteen bars do not need the weight that implies.
 */
export function UsageChart({ points, className }: UsageChartProps) {
  const [metric, setMetric] = useState<Metric>("words");
  const active = METRICS.find((entry) => entry.id === metric) ?? METRICS[0];
  const values = points.map((point) => point[metric]);
  const peak = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const busiest = points.reduce<UsagePoint | null>(
    (best, point) => (best === null || point[metric] > best[metric] ? point : best),
    null,
  );
  const barWidth = 100 / points.length;

  return (
    <Card className={className}>
      <CardHeader className="pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Usage, last {points.length} days</CardTitle>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Chart measure">
            {METRICS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setMetric(entry.id)}
                aria-pressed={metric === entry.id}
                className={cn(
                  "rounded-md border px-2 py-1 text-3xs font-medium transition-colors",
                  metric === entry.id
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <p className="text-2xs text-muted-foreground">
          {total === 0 ? (
            "Nothing recorded in this window yet. The bars appear as runs are made."
          ) : (
            <>
              {formatNumber(total)} {active.unit} in total
              {busiest && busiest[metric] > 0 ? (
                <>
                  , busiest on {busiest.label} ({formatNumber(busiest[metric])} {active.unit})
                </>
              ) : null}
              .
            </>
          )}
        </p>

        <div
          className="mt-3 overflow-x-auto"
          role="img"
          aria-label={`${active.label}: ${formatNumber(total)} ${active.unit} over ${points.length} days.`}
        >
          <div className="min-w-[24rem]">
            <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" className="h-28 w-full" aria-hidden="true">
              <line x1="0" y1={HEIGHT - 16} x2="100" y2={HEIGHT - 16} className="stroke-border" strokeWidth="0.4" />
              {points.map((point, index) => {
                const value = point[metric];
                const barHeight = value === 0 ? 0 : Math.max(1.5, (value / peak) * (HEIGHT - 30));
                return (
                  <g key={point.day}>
                    <rect
                      x={index * barWidth + barWidth * 0.22}
                      y={HEIGHT - 16 - barHeight}
                      width={barWidth * 0.56}
                      height={barHeight}
                      className={cn(
                        "transition-colors",
                        value === 0 ? "fill-transparent" : index === points.length - 1 ? "fill-primary" : "fill-primary/45",
                      )}
                    >
                      <title>{`${point.label}: ${formatNumber(value)} ${active.unit}`}</title>
                    </rect>
                    {value === 0 ? (
                      <circle cx={index * barWidth + barWidth / 2} cy={HEIGHT - 15} r="0.6" className="fill-border" />
                    ) : null}
                  </g>
                );
              })}
            </svg>
            <div className="mt-1 flex justify-between text-3xs text-muted-foreground">
              <span>{points[0]?.label}</span>
              <span>{points[points.length - 1]?.label}</span>
            </div>
          </div>
        </div>

        {/* The same figures as text, for anyone the picture does not reach. */}
        <table className="sr-only">
          <caption>{`Daily ${active.label.toLowerCase()}`}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{active.label}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={`row-${point.day}`}>
                <th scope="row">{point.label}</th>
                <td>{point[metric]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

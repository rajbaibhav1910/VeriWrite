import { useState } from "react";
import { Info } from "lucide-react";
import { CLASSIFICATION_BAND_RANGE } from "@/lib/detection/model";
import { tallyByBand } from "@/lib/detection/analytics";
import { CLASSIFICATION_DESCRIPTION, CLASSIFICATION_LABEL, cn, formatNumber } from "@/lib/utils";
import type { Classification, DetectionResult } from "@/types";

const CLASS_ORDER: Classification[] = [
  "ai_generated",
  "ai_generated_refined",
  "human_refined",
  "human_written",
];

const CLASS_TONE: Record<Classification, { swatch: string }> = {
  ai_generated: { swatch: "bg-signal-ai" },
  ai_generated_refined: { swatch: "bg-signal-mixed" },
  // A human-dominant class with assistance still visible, so the same hue at lower weight.
  human_refined: { swatch: "bg-signal-human/55" },
  human_written: { swatch: "bg-signal-human" },
};

/**
 * The counts under each card come from `tallyByBand`, the same band rule the engine
 * used for the percentages, so this screen cannot state a second, drifting
 * implementation of the split.
 */
export function ClassificationBreakdown({ result }: { result: DetectionResult }) {
  const [open, setOpen] = useState<Classification | null>(null);
  const tally = tallyByBand(result.sentences);
  const breakdown = result.breakdown;

  return (
    <section aria-labelledby="breakdown-heading" className="space-y-3">
      <div>
        <h3 id="breakdown-heading" className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Classification breakdown
        </h3>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
          How the measured words split across the four classes, by share of the total.
        </p>
      </div>

      <div
        role="img"
        aria-label={CLASS_ORDER.filter((key) => breakdown[key] > 0)
          .map((key) => `${CLASSIFICATION_LABEL[key]} ${breakdown[key]}%`)
          .join(", ")}
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {CLASS_ORDER.map((key) =>
          breakdown[key] > 0 ? (
            <span
              key={key}
              aria-hidden
              className={cn("h-full", CLASS_TONE[key].swatch)}
              style={{ width: `${breakdown[key]}%` }}
            />
          ) : null,
        )}
      </div>

      <ul className="space-y-2">
        {CLASS_ORDER.map((key) => {
          const share = breakdown[key];
          const expanded = open === key;
          const matched = result.classification === key;
          const panelId = `breakdown-detail-${key}`;
          return (
            <li
              key={key}
              className={cn(
                "rounded-lg border border-border bg-surface p-3",
                matched && "border-primary/45",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", CLASS_TONE[key].swatch)} />
                  <span className="truncate">{CLASSIFICATION_LABEL[key]}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular text-foreground">{share}%</span>
              </div>

              <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                {CLASSIFICATION_DESCRIPTION[key]}
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    aria-hidden
                    className={cn("block h-full rounded-full", CLASS_TONE[key].swatch)}
                    style={{ width: `${share}%` }}
                  />
                </span>
                {matched ? (
                  <span className="shrink-0 text-2xs text-primary">Matched class</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : key)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={`About ${CLASSIFICATION_LABEL[key]}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Info className={cn("size-3.5", expanded && "text-foreground")} aria-hidden />
                </button>
              </div>

              {expanded ? (
                <p
                  id={panelId}
                  role="status"
                  className="mt-2 border-t border-border pt-2 text-2xs leading-relaxed text-muted-foreground"
                >
                  This class counts sentences whose estimated AI likelihood is{" "}
                  {CLASSIFICATION_BAND_RANGE[key]}%. In this text{" "}
                  {formatNumber(tally[key].sentences)}{" "}
                  {tally[key].sentences === 1 ? "sentence" : "sentences"} (
                  {formatNumber(tally[key].words)} words) sit in that band. The four classes divide one
                  measurement made by {result.engine}; they are not four separate checks.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

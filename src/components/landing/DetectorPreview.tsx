import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  CLASSIFICATION_DESCRIPTION,
  CLASSIFICATION_LABEL,
  CONFIDENCE_LABEL,
  cn,
  formatPercent,
} from "@/lib/utils";
import type { Classification, ClassificationBreakdown, DetectedSignal, SignalKind } from "@/types";
import { Reveal, Section } from "./Section";

const ORDER: Classification[] = [
  "ai_generated",
  "ai_generated_refined",
  "human_refined",
  "human_written",
];

/** One illustrative distribution; the four values always sum to 100 by definition. */
const EXAMPLE_BREAKDOWN: ClassificationBreakdown = {
  ai_generated: 7,
  ai_generated_refined: 21,
  human_refined: 38,
  human_written: 34,
};

const CLASSIFICATION_STYLE: Record<
  Classification,
  { bar: string; badge: NonNullable<BadgeProps["variant"]> }
> = {
  ai_generated: { bar: "bg-signal-ai", badge: "signal-ai" },
  ai_generated_refined: { bar: "bg-signal-ai/55", badge: "signal-ai" },
  human_refined: { bar: "bg-signal-mixed", badge: "signal-mixed" },
  human_written: { bar: "bg-signal-human", badge: "signal-human" },
};

const SIGNAL_KINDS: Record<SignalKind, { label: string; note: string; dot: string }> = {
  human: { label: "Human", note: "Signals sit where prose reads as individual.", dot: "bg-signal-human" },
  ai: { label: "Machine", note: "Measured patterns lean machine-like here.", dot: "bg-signal-ai" },
  mixed: { label: "Mixed", note: "Both kinds of signal fired in the same span.", dot: "bg-signal-mixed" },
  neutral: { label: "Neutral", note: "Too little text in the span to say anything.", dot: "bg-signal-neutral" },
};

/** Shaped like the real payload so the sample matches what the product renders. */
const EXAMPLE_SIGNAL: DetectedSignal = {
  name: "predictable_phrasing",
  weight: 0.62,
  confidence: "high",
  explanation:
    "Some phrasing follows familiar patterns that show up often in formal or assisted writing.",
};

const READING_NOTES = [
  "The headline number is a probability. It is not the share of the text a machine produced.",
  "Short passages widen the confidence band; the label you get is qualified by that, on screen.",
  "Editing moves signals. A revised draft can change classification without changing who wrote it.",
];

export function DetectorPreview() {
  return (
    <Section
      id="detection-model"
      tone="sunken"
      eyebrow="The detection model"
      title="Four labels, one distribution, and the reasons underneath"
      description="A binary 'AI or human' answer is not something this text supports. VeriWrite reports four classifications, shows how the probability splits across them, and prints the signals that produced the split."
      align="split"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-16">
        <Reveal className="min-w-0">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            The four classifications
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Worked example: a 240-word passage edited by its author after drafting. The bars show how
            the model's probability mass is distributed across the four labels.
          </p>

          <ul className="mt-6 divide-y divide-border border-y border-border">
            {ORDER.map((key) => {
              const value = EXAMPLE_BREAKDOWN[key];
              const style = CLASSIFICATION_STYLE[key];
              return (
                <li key={key} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={style.badge} size="xs">
                        {CLASSIFICATION_LABEL[key]}
                      </Badge>
                      <span className="tabular font-mono text-2xs text-muted-foreground">
                        {formatPercent(value)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {CLASSIFICATION_DESCRIPTION[key]}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${CLASSIFICATION_LABEL[key]}: ${formatPercent(value)} of the probability mass`}
                    >
                      <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${value}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-2xs text-muted-foreground">
                      share of probability mass
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 rounded-md border border-border bg-card p-4 shadow-card">
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              The same split as one bar
            </p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Probability mass across the four classifications, summing to 100 percent">
              {ORDER.map((key) => (
                <div
                  key={key}
                  className={cn("h-full", CLASSIFICATION_STYLE[key].bar)}
                  style={{ width: `${EXAMPLE_BREAKDOWN[key]}%` }}
                />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              {ORDER.map((key) => (
                <li key={key} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span aria-hidden className={cn("size-1.5 rounded-full", CLASSIFICATION_STYLE[key].bar)} />
                  {CLASSIFICATION_LABEL[key]}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <div className="min-w-0 space-y-6">
          <Reveal delay={0.04}>
            <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              What a signal is
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A signal is one measured property of a span of text — the spread of its sentence lengths,
              how often it reaches for a stock transition, whether its clauses repeat a shape. Signals
              carry a weight and a confidence level, and they are what the score is made of. They are
              evidence about the writing, never evidence about the writer.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {(Object.keys(SIGNAL_KINDS) as SignalKind[]).map((kind) => (
                <li key={kind} className="rounded-md border border-border bg-card px-3 py-2.5 shadow-card">
                  <p className="flex items-center gap-2 text-xs font-semibold tracking-tight">
                    <span aria-hidden className={cn("size-1.5 rounded-full", SIGNAL_KINDS[kind].dot)} />
                    {SIGNAL_KINDS[kind].label}
                  </p>
                  <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                    {SIGNAL_KINDS[kind].note}
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.06}>
            <figure className="rounded-lg border border-border bg-card p-5 shadow-card">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
                  Explanation card
                </span>
                <Badge variant="outline" size="xs">
                  {CONFIDENCE_LABEL[EXAMPLE_SIGNAL.confidence]}
                </Badge>
              </figcaption>
              <p className="mt-3 text-sm font-semibold tracking-tight">Predictable phrasing</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {EXAMPLE_SIGNAL.explanation}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="h-1.5 flex-1 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-signal-ai"
                    style={{ width: `${EXAMPLE_SIGNAL.weight * 100}%` }}
                  />
                </span>
                <span className="tabular font-mono text-2xs text-muted-foreground">
                  weight {EXAMPLE_SIGNAL.weight.toFixed(2)}
                </span>
              </div>
              <p className="mt-3 font-mono text-2xs text-muted-foreground">
                signal: {EXAMPLE_SIGNAL.name} &middot; span: sentence 14 &middot; 21 words &middot; flagged
              </p>
            </figure>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-lg border border-info/35 bg-info-soft p-5">
              <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                <Info aria-hidden className="size-4 text-info" />
                Results are estimates
              </p>
              <ul className="mt-3 space-y-2">
                {READING_NOTES.map((note) => (
                  <li key={note} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-[0.5rem] size-1 shrink-0 rounded-full bg-info" />
                    {note}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-info/25 pt-3 text-xs leading-relaxed">
                <Link
                  to="/legal/ai-detection-limitations"
                  className="font-medium text-foreground underline decoration-info/50 underline-offset-4 hover:decoration-info"
                >
                  Read the detection limitations
                </Link>{" "}
                before you rely on a score, or run it on somebody else's work.
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        Want the same readout on your own passage?{" "}
        <Link to="/detector" className="font-medium text-foreground underline decoration-primary/50 underline-offset-4 hover:decoration-primary">
          Open the AI Detector
        </Link>{" "}
        — it runs without an account.
      </p>
    </Section>
  );
}

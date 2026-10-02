import { useId, useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SIGNAL_KIND_LABEL } from "@/lib/detection/signals";
import { CONFIDENCE_LABEL, cn } from "@/lib/utils";
import type { ExplanationCard, ExplanationGroup } from "@/lib/detection/explanations";
import type { SignalKind } from "@/types";

const BARS: Record<SignalKind, string> = {
  ai: "bg-signal-ai",
  human: "bg-signal-human",
  mixed: "bg-signal-mixed",
  neutral: "bg-signal-neutral",
};

const TEXT_TONE: Record<SignalKind, string> = {
  ai: "text-signal-ai",
  human: "text-signal-human",
  mixed: "text-signal-mixed",
  neutral: "text-signal-neutral",
};

const KIND_BADGE: Record<
  SignalKind,
  "signal-ai" | "signal-human" | "signal-mixed" | "signal-neutral"
> = {
  ai: "signal-ai",
  human: "signal-human",
  mixed: "signal-mixed",
  neutral: "signal-neutral",
};

interface ExplanationCardsProps {
  group: ExplanationGroup;
  /** Which span the cards describe, shown beside the heading: "Sentence 4 of 12". */
  spanLabel?: string;
  className?: string;
}

/**
 * The spec's explanation cards: one per model signal the engine reported for a
 * span, each with an info control, its confidence level and the engine's own
 * plain-English wording. All of that text is built by
 * `src/lib/detection/explanations.ts` and only rendered here, so a different
 * detection engine changes the words without changing the cards — and the cards
 * cannot claim more than the engine measured.
 */
export function ExplanationCards({ group, spanLabel, className }: ExplanationCardsProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h4 id={headingId} className="text-xs font-semibold text-foreground">
          {group.heading}
        </h4>
        {spanLabel ? <span className="text-2xs text-muted-foreground">{spanLabel}</span> : null}
        <Badge size="xs" variant={KIND_BADGE[group.tone]} className="ml-auto">
          {SIGNAL_KIND_LABEL[group.tone]}
        </Badge>
      </div>

      <p className="text-2xs leading-relaxed text-muted-foreground">{group.lead}</p>

      {group.cards.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
          Nothing stood out strongly enough for the engine to name a pattern here, so the estimate
          comes from the overall shape of the text rather than from any single marker.
        </p>
      ) : (
        <>
          {group.contextOnly ? (
            <p className="text-2xs leading-relaxed text-muted-foreground italic">
              Shown as context — these were measured across the whole text, not in this sentence.
            </p>
          ) : null}
          <ul className="space-y-2">
            {group.cards.map((card) => (
              <ExplanationCardRow key={card.key} card={card} tone={group.tone} />
            ))}
          </ul>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            A strength figure says how visibly the pattern appears. It is not the chance that the
            text is AI-written.
          </p>
        </>
      )}

      <p className="border-t border-border pt-2 text-2xs leading-relaxed text-muted-foreground">
        {group.note}
      </p>
    </section>
  );
}

function ExplanationCardRow({ card, tone }: { card: ExplanationCard; tone: SignalKind }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`How “${card.title}” was measured`}
          className={cn(
            "mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
            open ? TEXT_TONE[tone] : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Info className="size-3" aria-hidden />
        </button>

        <p className="min-w-0 flex-1 text-xs font-medium text-foreground">
          {card.title}
          {card.scope === "document" ? (
            <span className="ml-1 font-normal text-muted-foreground">(whole text)</span>
          ) : null}
        </p>

        <Badge size="xs" variant="outline">
          {CONFIDENCE_LABEL[card.confidence]}
        </Badge>
      </div>

      <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{card.body}</p>

      <div className="mt-2 flex items-center gap-2">
        <Progress
          value={card.strength}
          aria-label={`How strongly the ${card.title.toLowerCase()} pattern shows`}
          indicatorClassName={BARS[tone]}
          className="h-1"
        />
        <span className="shrink-0 text-2xs tabular text-muted-foreground">
          strength {card.strength}/100
        </span>
      </div>

      {open ? (
        <p
          id={panelId}
          role="status"
          className="mt-2 border-t border-border pt-2 text-2xs leading-relaxed text-muted-foreground"
        >
          {card.evidence}
        </p>
      ) : null}
    </li>
  );
}

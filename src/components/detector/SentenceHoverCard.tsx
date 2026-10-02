import { CONFIDENCE_LABEL, cn } from "@/lib/utils";
import { SIGNAL_KIND_LABEL, SIGNAL_KIND_NOTE, SIGNAL_NAME_LABEL } from "@/lib/detection/signals";
import { CLASSIFICATION_BAND_RANGE, bandFor } from "@/lib/detection/model";
import type { SentenceAnalysis } from "@/types";

const CARD_WIDTH = 264;

export interface SentenceHoverProps {
  sentence: SentenceAnalysis;
  /** Viewport rectangle of the painted sentence, reported by the editor. */
  rect: DOMRect;
  showConfidence: boolean;
}

/**
 * The hover read-out for one painted sentence: the estimate, the signal state and
 * the signals behind it. It repeats nothing the click panel does not also show, and
 * it is hidden from assistive technology on purpose - the sentence panel is the
 * accessible route to the same findings.
 */
export function SentenceHoverCard({ sentence, rect, showConfidence }: SentenceHoverProps) {
  const viewportWidth = typeof window === "undefined" ? rect.left + CARD_WIDTH : window.innerWidth;
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - CARD_WIDTH / 2),
    Math.max(8, viewportWidth - CARD_WIDTH - 8),
  );
  const placeBelow = rect.top < 190;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover p-3 text-2xs shadow-overlay"
      style={{
        left,
        top: placeBelow ? rect.bottom + 6 : rect.top - 6,
        width: CARD_WIDTH,
        transform: placeBelow ? undefined : "translateY(-100%)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Sentence {sentence.index + 1}
        </span>
        <span
          className={cn(
            "text-sm font-semibold tabular",
            sentence.signal === "ai"
              ? "text-signal-ai"
              : sentence.signal === "human"
                ? "text-signal-human"
                : sentence.signal === "mixed"
                  ? "text-signal-mixed"
                  : "text-signal-neutral",
          )}
        >
          {sentence.aiProbability}% AI
        </span>
      </div>

      <p className="mt-1.5 leading-relaxed text-muted-foreground">
        {SIGNAL_KIND_NOTE[sentence.signal]}
      </p>

      <dl className="mt-2 space-y-1 border-t border-border pt-2">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Signal</dt>
          <dd className="font-medium text-foreground">{SIGNAL_KIND_LABEL[sentence.signal]}</dd>
        </div>
        {showConfidence ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Confidence</dt>
            <dd className="font-medium text-foreground">{CONFIDENCE_LABEL[sentence.confidence]}</dd>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">Class</dt>
          <dd className="text-right font-medium text-foreground">
            {CLASSIFICATION_BAND_RANGE[bandFor(sentence.aiProbability)]}%
          </dd>
        </div>
      </dl>

      {sentence.signals.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
          {sentence.signals.map((signal) => (
            <li
              key={signal.name}
              className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-2xs text-muted-foreground"
            >
              {SIGNAL_NAME_LABEL[signal.name]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
          No individual signal stood out in this sentence.
        </p>
      )}
    </div>
  );
}

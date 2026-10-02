import { formatNumber } from "@/lib/utils";
import type { PlagiarismMatch } from "@/services/plagiarismService";

const CARD_WIDTH = 280;

export interface MatchHoverProps {
  match: PlagiarismMatch;
  /** Viewport rectangle of the painted passage, reported by the editor. */
  rect: DOMRect;
}

/**
 * The hover read-out for one matched passage: how it matched, what the source says,
 * and the address the engine compared it to. Assistive technology skips it — the
 * source panel is the accessible route to the same passage.
 */
export function MatchHoverCard({ match, rect }: MatchHoverProps) {
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
          {match.kind === "verbatim" ? "Verbatim words" : "Reworded sentence"}
        </span>
        <span className="tabular">
          {match.similarity}% · {formatNumber(match.words)} words
        </span>
      </div>

      <p className="mt-1.5 leading-relaxed text-foreground">{match.matchedText}</p>

      <p className="mt-1.5 border-t border-border pt-1.5 leading-relaxed text-muted-foreground">
        {match.sourceTitle}: “{match.sourceText}”
      </p>

      <p className="mt-1.5 break-all text-muted-foreground">{match.url}</p>
    </div>
  );
}

import { ISSUE_CATEGORY_LABEL, CONFIDENCE_LABEL } from "@/lib/utils";
import type { GrammarIssue } from "@/types";

const CARD_WIDTH = 264;

export interface IssueHoverProps {
  issue: GrammarIssue;
  /** Viewport rectangle of the underlined passage, reported by the editor. */
  rect: DOMRect;
}

/**
 * The hover read-out for one finding: what was flagged, what would change, and a
 * line of the explanation. It repeats nothing the click panel does not also show,
 * and assistive technology skips it — the panel is the accessible route to the
 * same finding.
 */
export function IssueHoverCard({ issue, rect }: IssueHoverProps) {
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
          {ISSUE_CATEGORY_LABEL[issue.category]}
        </span>
        <span className="text-muted-foreground">{CONFIDENCE_LABEL[issue.confidence]}</span>
      </div>

      <p className="mt-1.5 leading-relaxed text-foreground">
        <span className="text-error line-through decoration-error/40">{issue.original}</span>
        {issue.suggestion !== issue.original && issue.suggestion.length > 0 ? (
          <span className="ml-1.5 text-success">{issue.suggestion}</span>
        ) : (
          <span className="ml-1.5 text-muted-foreground">— advice only</span>
        )}
      </p>

      <p className="mt-1.5 border-t border-border pt-1.5 leading-relaxed text-muted-foreground">
        {issue.explanation}
      </p>

      <p className="mt-1.5 text-muted-foreground">
        {issue.state === "accepted"
          ? "Queued: it will be written in when you replace the queue."
          : issue.state === "ignored"
            ? "Ignored: your wording stays."
            : "Click it to accept, ignore or replace."}
      </p>
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SignalKind } from "@/types";

// Static class strings per signal: Tailwind needs to see them verbatim.
const signalSurface: Record<SignalKind, string> = {
  ai: "bg-signal-ai-bg decoration-signal-ai-line",
  human: "bg-signal-human-bg decoration-signal-human-line",
  mixed: "bg-signal-mixed-bg decoration-signal-mixed-line",
  neutral: "bg-signal-neutral-bg decoration-signal-neutral-line",
};

export interface HighlightProps extends Omit<React.ComponentPropsWithRef<"span">, "onClick"> {
  signal: SignalKind;
  /** Ring + raised z for the segment the reader is focused on. */
  active?: boolean;
  dimmed?: boolean;
  showScore?: boolean;
  /** 0-100 AI probability, rendered as a quiet superscript. */
  score?: number;
  id?: string;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

const Highlight = React.forwardRef<HTMLSpanElement, HighlightProps>(function Highlight(
  { className, signal, active = false, dimmed = false, showScore = false, score, id, onClick, children, ...props },
  ref,
) {
  const interactive = typeof onClick === "function";

  return (
    // No title attribute: the data-* pair drives the parent's floating detail card.
    <span
      ref={ref}
      id={id}
      data-highlight=""
      data-signal={signal}
      data-score={score === undefined ? undefined : Math.round(score)}
      data-active={active ? "true" : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.(event as unknown as React.MouseEvent<HTMLSpanElement>);
              }
            }
          : undefined
      }
      className={cn(
        "box-decoration-clone rounded-xs underline decoration-2 underline-offset-[0.18em] outline-none transition-opacity",
        signalSurface[signal],
        "focus-visible:ring-2 focus-visible:ring-ring",
        interactive && "cursor-pointer",
        active && "ring-2 ring-ring",
        dimmed && "opacity-45 hover:opacity-80",
        className,
      )}
      {...props}
    >
      {children}
      {showScore && score !== undefined ? (
        <sup className="tabular ml-0.5 align-super text-2xs font-medium text-muted-foreground">
          {Math.round(score)}
        </sup>
      ) : null}
    </span>
  );
});
Highlight.displayName = "Highlight";

export { Highlight, signalSurface };

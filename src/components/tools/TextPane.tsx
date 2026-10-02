import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import { countCharacters, countWords, readingTimeSeconds, splitSentences } from "@/lib/text";

interface TextPaneProps {
  /** The word above the pane, and the name every control in it belongs to. */
  label: string;
  /** Shown beside the label when one pane is the source and the other the result. */
  role?: string;
  value: string;
  onChange?(value: string): void;
  placeholder: string;
  /** Small controls on the right of the pane header. */
  toolbar?: ReactNode;
  /** Replaces the text area: a pane that shows a result rather than takes input. */
  body?: ReactNode;
  empty?: ReactNode;
  /** Writing direction of the text inside: a right-to-left language reads right-to-left. */
  dir?: "rtl" | "ltr";
  className?: string;
}

/**
 * A counted writing surface. Both paraphraser panes use it, so the figures under the
 * text and the way it handles an empty document are the same on each side.
 */
export function TextPane({
  label,
  role,
  value,
  onChange,
  placeholder,
  toolbar,
  body,
  empty,
  dir,
  className,
}: TextPaneProps) {
  const words = countWords(value);
  const sentences = splitSentences(value).length;

  return (
    <Card className={cn("flex min-h-[24rem] flex-col overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {role ? (
          <Badge variant="subtle" size="xs">
            {role}
          </Badge>
        ) : null}
        {toolbar ? <div className="ml-auto flex items-center gap-1">{toolbar}</div> : null}
      </div>

      <div dir={dir} className="flex min-h-0 flex-1 flex-col">
        {body ??
          (value.length === 0 && empty ? (
            <div className="flex flex-1 items-center justify-center px-5 py-8">{empty}</div>
          ) : (
            <textarea
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              placeholder={placeholder}
              aria-label={label}
              className="min-h-[18rem] w-full flex-1 resize-y bg-transparent px-5 py-4 text-[0.9375rem] leading-[1.7] text-foreground outline-none placeholder:text-muted-foreground"
            />
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border bg-surface px-5 py-2 text-2xs text-muted-foreground tabular">
        <span>{formatNumber(words)} words</span>
        <span>{formatNumber(countCharacters(value))} characters</span>
        <span>{formatNumber(sentences)} sentences</span>
        <span>{formatDuration(readingTimeSeconds(words))} read</span>
      </div>
    </Card>
  );
}

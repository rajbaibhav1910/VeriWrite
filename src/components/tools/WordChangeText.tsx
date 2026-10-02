import { Fragment } from "react";
import type { WordChangeMap } from "@/lib/tools/wordDiff";

interface WordChangeTextProps {
  /** The rewrite, word by word, as the comparison produced it. */
  map: WordChangeMap;
  /** The rewrite itself, so the spacing between words survives untouched. */
  output: string;
}

/**
 * The rewrite with the words it introduced marked. Everything unmarked is copied out
 * of the rewrite verbatim, so this reads exactly like the text in the pane above it.
 */
export function WordChangeText({ map, output }: WordChangeTextProps) {
  const parts: { text: string; changed: boolean }[] = [];
  let cursor = 0;
  for (const word of map.words) {
    if (word.start > cursor) parts.push({ text: output.slice(cursor, word.start), changed: false });
    parts.push({ text: word.text, changed: word.changed });
    cursor = word.end;
  }
  if (cursor < output.length) parts.push({ text: output.slice(cursor), changed: false });

  return (
    <p className="whitespace-pre-wrap text-[0.9375rem] leading-[1.7] text-foreground">
      {parts.map((part, index) =>
        part.changed ? (
          <mark
            key={index}
            className="rounded-xs bg-primary/12 px-0.5 text-foreground"
            title="A word the rewrite introduced"
          >
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </p>
  );
}

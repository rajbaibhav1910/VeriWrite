import type { Node as PMNode } from "@tiptap/pm/model";
import { normalizeText } from "@/lib/text";
import type { SentenceAnalysis } from "@/types";
import { DETECTION_BLOCK_SEPARATOR } from "./serialize";

type TextSerializer = (data: {
  node: PMNode;
  pos: number;
  parent: PMNode | null;
  index: number;
}) => string;

export type PlainTextKind = "text" | "leaf" | "separator";

export interface PlainTextIndex {
  /** The same string `editor.getText({ blockSeparator })` produces. */
  text: string;
  /** `positions[i]` is the ProseMirror position holding `text[i]`. */
  positions: number[];
  /** How each character got there, so a caller can tell real text from inserted breaks. */
  kinds: PlainTextKind[];
}

/**
 * Walks the document the way TipTap's own text serializer does — a block
 * separator before every block after the first, a node's `toText` for leaf
 * nodes such as hard breaks — and records where each character lives. Keeping
 * the two rules in one place is what makes the highlight ranges line up with
 * the text the detector read.
 */
export function buildPlainTextIndex(
  doc: PMNode,
  blockSeparator = DETECTION_BLOCK_SEPARATOR,
): PlainTextIndex {
  let text = "";
  const positions: number[] = [];
  const kinds: PlainTextKind[] = [];

  doc.nodesBetween(0, doc.content.size, (node, pos, parent, index) => {
    if (node.isBlock && pos > 0) {
      text += blockSeparator;
      for (let i = 0; i < blockSeparator.length; i += 1) {
        positions.push(pos);
        kinds.push("separator");
      }
    }

    if (node.isText) {
      const value = node.text ?? "";
      text += value;
      for (let i = 0; i < value.length; i += 1) {
        positions.push(pos + i);
        kinds.push("text");
      }
      return false;
    }

    const serialize = node.type.spec.toText as TextSerializer | undefined;
    if (serialize) {
      const chunk = serialize({ node, pos, parent: parent ?? null, index });
      text += chunk;
      for (let i = 0; i < chunk.length; i += 1) {
        positions.push(pos);
        kinds.push("leaf");
      }
      return false;
    }

    return true;
  });

  return { text, positions, kinds };
}

/**
 * Normalising text never invents content: it deletes characters, except that a
 * run of spaces and tabs leaves a single space behind and a line ending leaves
 * a line feed. So the normalised string is a subsequence of the raw one once
 * those two substitutions are allowed, and walking both left to right recovers
 * which raw character each normalised one came from. Returns null when the two
 * strings disagree, which means the mapping cannot be trusted and nothing is
 * highlighted rather than something highlighted in the wrong place.
 */
export function alignNormalizedToRaw(raw: string, normalized: string): number[] | null {
  const map = new Array<number>(normalized.length);
  let cursor = 0;

  const holds = (rawChar: string, wanted: string) =>
    rawChar === wanted ||
    // A normalised line feed can come from either half of a CRLF pair.
    (wanted === "\n" && rawChar === "\r") ||
    // A normalised space can be the survivor of a spaces-and-tabs run.
    (wanted === " " && rawChar === "\t");

  for (let n = 0; n < normalized.length; n += 1) {
    const wanted = normalized[n];
    while (cursor < raw.length && !holds(raw[cursor], wanted)) cursor += 1;
    if (cursor >= raw.length) return null;
    map[n] = cursor;
    cursor += 1;
  }

  return map;
}

export interface MappedSentence {
  sentence: SentenceAnalysis;
  /** ProseMirror document range holding the sentence. */
  from: number;
  to: number;
}

export interface SentenceMapping {
  mapped: MappedSentence[];
  /** Sentences the mapping refused to place, counted rather than silently dropped. */
  unmapped: number;
  reason: string | null;
}

/** Anything reported with offsets in the normalised form of the text that was read. */
export interface NormalizedSpan {
  start: number;
  end: number;
}

export interface MappedSpan<T extends NormalizedSpan> {
  item: T;
  /** ProseMirror document range holding the span. */
  from: number;
  to: number;
}

export interface SpanMapping<T extends NormalizedSpan> {
  mapped: MappedSpan<T>[];
  /** Spans the mapping refused to place, counted rather than silently dropped. */
  unmapped: number;
  reason: string | null;
}

/**
 * Places ranges that were measured in the normalised text into document ranges.
 * The reader normalises before measuring, so each range goes normalised offset ->
 * plain-text offset -> ProseMirror position, and the whole pass is refused when the
 * editor no longer holds the text that was measured or the two cannot be aligned.
 */
export function mapNormalizedSpansToDocument<T extends NormalizedSpan>(
  items: T[],
  analysedText: string,
  doc: PMNode,
): SpanMapping<T> {
  const index = buildPlainTextIndex(doc);

  if (index.text !== analysedText) {
    return {
      mapped: [],
      unmapped: items.length,
      reason: "the text in the editor no longer matches the analysed text",
    };
  }

  const normalized = normalizeText(analysedText);
  const toRaw = alignNormalizedToRaw(index.text, normalized);
  if (!toRaw) {
    return {
      mapped: [],
      unmapped: items.length,
      reason: "the analysis offsets could not be traced back to this text",
    };
  }

  const mapped: MappedSpan<T>[] = [];
  let unmapped = 0;

  for (const item of items) {
    const rawStart = toRaw[item.start];
    const rawEnd = toRaw[Math.min(item.end, normalized.length) - 1];
    const range =
      rawStart === undefined || rawEnd === undefined
        ? null
        : rangeInDocument(index, rawStart, rawEnd + 1);

    if (!range) {
      unmapped += 1;
      continue;
    }
    mapped.push({ item, ...range });
  }

  return { mapped, unmapped, reason: null };
}

/**
 * Turns the engine's sentence offsets into document ranges. The engine reports
 * positions in the normalised text it was given, so each range goes
 * normalised offset -> plain-text offset -> ProseMirror position.
 */
export function mapSentencesToDocument(
  sentences: SentenceAnalysis[],
  analysedText: string,
  doc: PMNode,
): SentenceMapping {
  const result = mapNormalizedSpansToDocument(sentences, analysedText, doc);
  return {
    mapped: result.mapped.map((entry) => ({ sentence: entry.item, from: entry.from, to: entry.to })),
    unmapped: result.unmapped,
    reason: result.reason,
  };
}

/**
 * The one place that decides whether a plain-text range may be painted. Both
 * mapping directions end here, so a mark either lands on characters that exist
 * in the document or is refused. A range that runs over a block separator is
 * refused whole: it would colour the gap between two paragraphs, and editing it
 * would merge the paragraphs behind the reader's back.
 */
function rangeInDocument(
  index: PlainTextIndex,
  start: number,
  end: number,
): { from: number; to: number } | null {
  if (!(start < end)) return null;
  const last = Math.min(end, index.text.length) - 1;
  if (!(start <= last)) return null;
  const from = index.positions[start];
  const to = index.positions[last];
  if (from === undefined || to === undefined || from > to) return null;
  for (let i = start; i <= last; i += 1) {
    if (index.kinds[i] === "separator") return null;
  }
  return { from, to: to + 1 };
}

/** Anything the checker reports as a range in the text it read. */
export interface OffsetRange {
  start: number;
  end: number;
  original: string;
}

export interface MappedRange<T extends OffsetRange> {
  item: T;
  /** ProseMirror document range holding the flagged text. */
  from: number;
  to: number;
}

export interface RangeMapping<T extends OffsetRange> {
  mapped: MappedRange<T>[];
  /** Findings the mapping refused to place, counted rather than silently dropped. */
  unmapped: number;
  reason: string | null;
}

/**
 * Places checker findings, whose offsets are already positions in the raw text
 * the checker read, into document ranges. A finding is refused when those
 * offsets no longer spell out the text it quotes — the checker and the editor
 * have drifted apart, and painting the mark over whatever sits there now, or
 * editing it, would touch the wrong words.
 */
export function mapIssueRangesToDocument<T extends OffsetRange>(
  items: T[],
  checkedText: string,
  doc: PMNode,
): RangeMapping<T> {
  const index = buildPlainTextIndex(doc);

  if (index.text !== checkedText) {
    return {
      mapped: [],
      unmapped: items.length,
      reason: "the text in the editor no longer matches the checked text",
    };
  }

  const mapped: MappedRange<T>[] = [];
  let unmapped = 0;

  for (const item of items) {
    const range = rangeInDocument(index, item.start, item.end);
    // An empty quote has nothing to verify against, so it cannot be trusted.
    const stillThere =
      item.original.length > 0 && index.text.slice(item.start, item.end) === item.original;
    if (!range || !stillThere) {
      unmapped += 1;
      continue;
    }
    mapped.push({ item, ...range });
  }

  return { mapped, unmapped, reason: null };
}

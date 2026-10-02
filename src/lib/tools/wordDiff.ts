import { splitSentences, tokenSpans } from "@/lib/text";

/**
 * Which words the rewrite actually put there, and which it took away.
 *
 * The rewrite keeps sentence order, so the two texts are lined up sentence by
 * sentence and the words that survive in the same sequence are treated as kept.
 * When the texts no longer line up sentence for sentence the map falls back to
 * counting word kinds, and says so — a reader should never be shown a confident
 * highlight that the comparison cannot support.
 */

export interface WordChange {
  text: string;
  start: number;
  end: number;
  changed: boolean;
}

export interface WordChangeMap {
  /** Every word of the rewrite, in reading order, with its offsets. */
  words: WordChange[];
  /** Words of the original the rewrite no longer holds. */
  dropped: number;
  /** Rewrite words with no matching word in the original. */
  introduced: number;
  originalWords: number;
  rewriteWords: number;
  /** True when each sentence was matched with its own counterpart. */
  aligned: boolean;
}

const KEY = /[\p{L}\p{N}]+/u;

/** Cells a single sentence pair may need before the comparison stops being cheap. */
const MAX_ALIGNMENT_CELLS = 1_000_000;

function keyOf(word: string): string {
  const match = word.toLowerCase().match(KEY);
  return match ? match[0] : word.toLowerCase();
}

/** Longest shared subsequence over two word lists, as indexes into `b`. */
function keptIndexes(a: string[], b: string[]): Set<number> {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cell =
        a[i - 1] === b[j - 1]
          ? table[(i - 1) * cols + j - 1] + 1
          : Math.max(table[(i - 1) * cols + j], table[i * cols + j - 1]);
      table[i * cols + j] = cell;
    }
  }
  const kept = new Set<number>();
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      kept.add(j - 1);
      i -= 1;
      j -= 1;
      continue;
    }
    if (table[(i - 1) * cols + j] >= table[i * cols + j - 1]) i -= 1;
    else j -= 1;
  }
  return kept;
}

/** Split a text into its sentences, with the words each one holds. */
function sentences(text: string) {
  return splitSentences(text).map((span) => ({
    start: span.start,
    end: span.end,
    words: tokenSpans(span.text),
  }));
}

export function mapWordChanges(input: string, output: string): WordChangeMap {
  const inputTokens = tokenSpans(input).map((span) => keyOf(span.text));
  const outputTokens = tokenSpans(output);

  const inSentences = sentences(input);
  const outSentences = sentences(output);
  // One very long sentence would need a comparison table the size of its word count
  // squared, so a pair that big is compared as word kinds instead.
  const heaviestPair = inSentences.reduce(
    (worst, sentence, index) =>
      Math.max(worst, sentence.words.length * (outSentences[index]?.words.length ?? 0)),
    0,
  );
  const pairable =
    inSentences.length > 0 &&
    inSentences.length === outSentences.length &&
    heaviestPair <= MAX_ALIGNMENT_CELLS;

  const words: WordChange[] = [];
  let dropped = 0;
  let introduced = 0;

  const counts = {
    originalWords: inputTokens.length,
    rewriteWords: outputTokens.length,
  };

  if (pairable) {
    for (let s = 0; s < inSentences.length; s += 1) {
      const before = inSentences[s].words.map((span) => keyOf(span.text));
      const after = outSentences[s].words.map((span) => keyOf(span.text));
      const kept = keptIndexes(before, after);
      dropped += before.length - kept.size;
      after.forEach((_key, index) => {
        const changed = !kept.has(index);
        if (changed) introduced += 1;
        const span = outSentences[s].words[index];
        words.push({
          text: span.text,
          start: span.start + outSentences[s].start,
          end: span.end + outSentences[s].start,
          changed,
        });
      });
    }
    return { words, dropped, introduced, ...counts, aligned: true };
  }

  // The texts drifted apart, so only word kinds can be compared.
  const pool = new Map<string, number>();
  for (const key of inputTokens) pool.set(key, (pool.get(key) ?? 0) + 1);
  let matched = 0;
  outputTokens.forEach((span) => {
    const key = keyOf(span.text);
    const available = pool.get(key) ?? 0;
    const changed = available === 0;
    if (changed) introduced += 1;
    else {
      pool.set(key, available - 1);
      matched += 1;
    }
    words.push({ ...span, changed });
  });
  return {
    words,
    dropped: inputTokens.length - matched,
    introduced,
    ...counts,
    aligned: false,
  };
}

/** A short, plain read-out of what changed, for a caption or a toast. */
export function describeWordChanges(map: WordChangeMap): string {
  const changed = formatCount(map.dropped);
  if (map.rewriteWords === 0) return "The rewrite holds no words.";
  if (!map.aligned) {
    return `${changed} of your words no longer appear, and ${formatCount(map.introduced)} words in the rewrite are new to the original. The two texts no longer run sentence for sentence, so the marks compare word kinds rather than positions.`;
  }
  return `${changed} of your words no longer appear, and ${formatCount(map.introduced)} words in the rewrite are new to the original.`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

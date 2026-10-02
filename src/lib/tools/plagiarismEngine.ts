import type { PlagiarismResult, PlagiarismSource } from "@/types";
import { normalizeText, splitSentences, truncate } from "@/lib/text";
import {
  PLAGIARISM_CORPUS,
  PLAGIARISM_DEMO_NOTICE,
  type CorpusEntry,
} from "@/data/plagiarismCorpus";

export { PLAGIARISM_DEMO_NOTICE };

/**
 * Offline similarity matching against a bundled corpus.
 *
 * What this is: a real string-similarity engine. It finds verbatim word runs of
 * eight or more words, and near-paraphrase overlap between individual sentences,
 * and it reports the actual spans it found. Every number in the result is
 * derived from those spans.
 *
 * What this is not: a web scan. The corpus is ten passages written for this
 * build (`src/data/plagiarismCorpus.ts`), so a clean result means "no match in
 * this demo corpus", never "this text is original". `demo: true` is hard-coded
 * and the notice travels with every result so the UI cannot drop it.
 */

export interface PlagiarismMatch {
  id: string;
  sourceId: string;
  sourceTitle: string;
  url: string;
  /** "verbatim" = eight or more consecutive words; "near" = shared content words. */
  kind: "verbatim" | "near-paraphrase";
  /** Character offsets into the normalized input text. */
  start: number;
  end: number;
  matchedText: string;
  /** Source-side passage the span matched. */
  sourceText: string;
  similarity: number;
  words: number;
}

export interface PlagiarismScan extends PlagiarismResult {
  matches: PlagiarismMatch[];
  wordsScanned: number;
  corpusSize: number;
  notice: string;
}

export interface PlagiarismOptions {
  /** Minimum consecutive words for a verbatim hit. Default 8. */
  minRun?: number;
  /** Minimum shared content words for a near-paraphrase hit. Default 6. */
  minSharedWords?: number;
  /** Minimum overlap coefficient for a near-paraphrase hit. Default 0.55. */
  minOverlap?: number;
}

interface Token {
  surface: string;
  lower: string;
  start: number;
  end: number;
}

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’\-_]*/gu;

function tokenizeWithOffsets(text: string): Token[] {
  const out: Token[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    const surface = match[0];
    out.push({ surface, lower: surface.toLowerCase(), start: match.index, end: match.index + surface.length });
  }
  return out;
}

const STOPWORDS = new Set(
  ("a an the and or but if then than that this these those of in on at to for from by with without into over under again further once here there all any both each few more most other some such no nor not only own same so too very can will just should now he she it they them his her its their we you your i me my mine our ours him them they're is are was were be been being do does did doing have has had having as about after before between during out off very much many little also may might must would could").split(" "),
);

function contentWords(tokens: Token[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t.lower) && t.lower.length > 1).map((t) => t.lower);
}

/** Index of every `n`-gram in the source, keyed by its lowercase join. */
function ngramIndex(words: string[], n: number): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i + n <= words.length; i += 1) {
    const key = words.slice(i, i + n).join(" ");
    const bucket = index.get(key);
    if (bucket) bucket.push(i);
    else index.set(key, [i]);
  }
  return index;
}

interface Run {
  targetStart: number;
  sourceStart: number;
  length: number;
}

/**
 * Maximal shared word runs. Seeded on exact `n`-grams, then extended in both
 * directions, and any run that overlaps one already accepted is skipped so the
 * matched-word count cannot double up.
 */
function findRuns(target: string[], source: string[], n: number): Run[] {
  const index = ngramIndex(source, n);
  const runs: Run[] = [];
  const taken = new Array<boolean>(target.length).fill(false);
  for (let i = 0; i + n <= target.length; i += 1) {
    const seeds = index.get(target.slice(i, i + n).join(" "));
    if (!seeds) continue;
    let best: { targetStart: number; sourceStart: number; length: number } | null = null;
    for (const s of seeds) {
      let left = 0;
      while (i - left - 1 >= 0 && s - left - 1 >= 0 && target[i - left - 1] === source[s - left - 1]) left += 1;
      let right = 0;
      while (i + n + right < target.length && s + n + right < source.length && target[i + n + right] === source[s + n + right]) right += 1;
      const candidate = { targetStart: i - left, sourceStart: s - left, length: n + left + right };
      if (!best || candidate.length > best.length) best = candidate;
    }
    if (!best) continue;
    let clash = false;
    for (let k = best.targetStart; k < best.targetStart + best.length; k += 1) if (taken[k]) clash = true;
    if (clash) continue;
    for (let k = best.targetStart; k < best.targetStart + best.length; k += 1) taken[k] = true;
    runs.push({ targetStart: best.targetStart, sourceStart: best.sourceStart, length: best.length });
  }
  return runs.sort((a, b) => a.targetStart - b.targetStart);
}

function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function sharedCount(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared;
}

interface SourceSentence {
  text: string;
  tokens: Token[];
  content: Set<string>;
}

function sourceSentences(text: string): SourceSentence[] {
  return splitSentences(text).map((span) => {
    const tokens = tokenizeWithOffsets(span.text);
    return { text: span.text, tokens, content: new Set(contentWords(tokens)) };
  });
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  return (2 * sharedCount(a, b)) / (a.size + b.size);
}

export function scanPlagiarism(
  input: string,
  corpus: CorpusEntry[] = PLAGIARISM_CORPUS,
  options: PlagiarismOptions = {},
): PlagiarismScan {
  const minRun = options.minRun ?? 8;
  const minSharedWords = options.minSharedWords ?? 6;
  const minOverlap = options.minOverlap ?? 0.55;

  const text = normalizeText(input);
  const targetTokens = tokenizeWithOffsets(text);
  const targetWords = targetTokens.map((t) => t.lower);
  const matched = new Array<boolean>(targetTokens.length).fill(false);
  const matches: PlagiarismMatch[] = [];

  /**
   * The input's sentences, each holding the whole-text token indexes inside it. Taken
   * once, here, so every offset below stays absolute: tokenizing a sentence slice
   * would give positions inside that slice, which cannot be pointed at in the document.
   */
  const targetSentences: { indexes: number[]; content: Set<string> }[] = [];
  let cursor = 0;
  for (const span of splitSentences(text)) {
    while (cursor < targetTokens.length && targetTokens[cursor].end <= span.start) cursor += 1;
    const indexes: number[] = [];
    const content = new Set<string>();
    for (let i = cursor; i < targetTokens.length && targetTokens[i].start < span.end; i += 1) {
      indexes.push(i);
      const lower = targetTokens[i].lower;
      if (!STOPWORDS.has(lower) && lower.length > 1) content.add(lower);
    }
    targetSentences.push({ indexes, content });
  }

  for (const entry of corpus) {
    const sourceTokens = tokenizeWithOffsets(normalizeText(entry.text));
    const sourceWords = sourceTokens.map((t) => t.lower);

    // 1. Verbatim runs of `minRun` or more consecutive words.
    for (const run of findRuns(targetWords, sourceWords, minRun)) {
      const from = run.targetStart;
      const to = run.targetStart + run.length - 1;
      for (let i = from; i <= to; i += 1) matched[i] = true;
      const targetSpan = targetTokens.slice(from, to + 1);
      const sourceSpan = sourceTokens.slice(run.sourceStart, run.sourceStart + run.length);
      matches.push({
        id: `${entry.id}_v${targetSpan[0]?.start ?? 0}`,
        sourceId: entry.id,
        sourceTitle: entry.title,
        url: entry.url,
        kind: "verbatim",
        start: targetSpan[0]?.start ?? 0,
        end: targetSpan[targetSpan.length - 1]?.end ?? 0,
        matchedText: text.slice(targetSpan[0]?.start ?? 0, targetSpan[targetSpan.length - 1]?.end ?? 0),
        similarity: 100,
        words: targetSpan.length,
        sourceText: sourceSpan.map((t) => t.surface).join(" "),
      });
    }

    // 2. Near-paraphrase: sentence pairs that share most of their content words.
    const sentences = sourceSentences(entry.text);
    for (const targetSentence of targetSentences) {
      if (targetSentence.content.size < minSharedWords) continue;
      let best: { sentence: SourceSentence; overlap: number } | null = null;
      for (const sentence of sentences) {
        const overlap = overlapCoefficient(targetSentence.content, sentence.content);
        if (
          overlap >= minOverlap &&
          sharedCount(targetSentence.content, sentence.content) >= minSharedWords
        ) {
          if (!best || overlap > best.overlap) best = { sentence, overlap };
        }
      }
      if (!best) continue;
      // Count only the participating words, so a paraphrase is not scored as a copy,
      // and skip words an earlier finding already claimed — a copied sentence is one
      // piece of evidence, not a verbatim run and a paraphrase of it.
      const shared = best.sentence.content;
      const hits = targetSentence.indexes.filter(
        (index) => !matched[index] && shared.has(targetTokens[index].lower),
      );
      if (hits.length === 0) continue;
      for (const index of hits) matched[index] = true;
      const first = targetTokens[hits[0]];
      const last = targetTokens[hits[hits.length - 1]];
      matches.push({
        id: `${entry.id}_n${first.start}`,
        sourceId: entry.id,
        sourceTitle: entry.title,
        url: entry.url,
        kind: "near-paraphrase",
        start: first.start,
        end: last.end,
        matchedText: text.slice(first.start, last.end),
        similarity: Math.round(dice(targetSentence.content, shared) * 100),
        words: hits.length,
        sourceText: best.sentence.text,
      });
    }
  }

  const matchedWords = matched.filter(Boolean).length;
  const totalWords = targetTokens.length;
  const matchedPercentage = totalWords === 0 ? 0 : Math.round((matchedWords / totalWords) * 1000) / 10;

  const bySource = new Map<string, PlagiarismMatch[]>();
  for (const match of matches) {
    const list = bySource.get(match.sourceId);
    if (list) list.push(match);
    else bySource.set(match.sourceId, [match]);
  }

  const sources: PlagiarismSource[] = [...bySource.entries()]
    .map(([sourceId, list]) => {
      const entry = corpus.find((c) => c.id === sourceId);
      const sorted = [...list].sort((a, b) => a.start - b.start);
      const unionTarget = new Set<string>();
      const unionSource = new Set<string>();
      for (const m of sorted) {
        for (const w of contentWords(tokenizeWithOffsets(m.matchedText))) unionTarget.add(w);
        for (const w of contentWords(tokenizeWithOffsets(m.sourceText))) unionSource.add(w);
      }
      const similarity = sorted.some((m) => m.kind === "verbatim")
        ? Math.max(...sorted.map((m) => m.similarity))
        : // `dice` is a fraction; the card shows a percentage, like every other figure.
          Math.min(100, Math.round(dice(unionTarget, unionSource) * 100));
      return {
        id: sourceId,
        title: entry?.title ?? sourceId,
        url: entry?.url ?? "",
        snippet: entry?.snippet ?? truncate(sorted.map((m) => m.sourceText).join(" "), 180),
        similarity,
        matchedText: truncate(sorted.map((m) => m.matchedText).join(" … "), 400),
        publishedAt: entry?.publishedAt,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const ordered = matches.sort((a, b) => a.start - b.start);

  return {
    documentId: "local",
    originality: Math.round((100 - matchedPercentage) * 10) / 10,
    matchedPercentage,
    sources,
    scannedAt: new Date().toISOString(),
    demo: true,
    matches: ordered,
    wordsScanned: totalWords,
    corpusSize: corpus.length,
    notice: demoNotice(corpus.length),
  };
}

/** The notice is rebuilt from the corpus size so the count can never drift. */
function demoNotice(size: number): string {
  return PLAGIARISM_DEMO_NOTICE.replace("ten passages", `${size} passages`);
}

/** How many passages the bundled corpus holds, read from the corpus itself. */
export const PLAGIARISM_CORPUS_SIZE = PLAGIARISM_CORPUS.length;

/** Honest scope line for the empty state / header badge. */
export const PLAGIARISM_SCOPE = `Checks against a bundled demo corpus of ${PLAGIARISM_CORPUS_SIZE} passages. It does not search the web, academic databases or student repositories.`;

/** Highlight data for the editor: which character ranges matched, and how. */
export interface PlagiarismSpan {
  start: number;
  end: number;
  kind: PlagiarismMatch["kind"];
  sourceTitle: string;
  url: string;
}

export function plagiarismSpans(scan: PlagiarismScan): PlagiarismSpan[] {
  return scan.matches.map((match) => ({
    start: match.start,
    end: match.end,
    kind: match.kind,
    sourceTitle: match.sourceTitle,
    url: match.url,
  }));
}

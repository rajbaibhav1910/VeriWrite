import type { SummaryResult } from "@/types";
import { countWords, splitParagraphs, splitSentences, tokenize } from "@/lib/text";
import { clamp } from "@/lib/utils";

/**
 * Extractive summariser: TF-IDF sentence vectors scored against a document
 * centroid, with a position prior and an MMR-style redundancy filter.
 * Output sentences stay verbatim, so a reader can always check them upstream.
 */

export type SummaryFormat = SummaryResult["format"];

export interface SummarizerOptions {
  /** Target number of sentences in the summary. */
  length: number;
  format: SummaryFormat;
}

export interface SentenceScore {
  index: number;
  text: string;
  start: number;
  end: number;
  score: number;
  selected: boolean;
}

const STOPWORDS = new Set(`a about above after again against all also am an and any are as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves it's don't isn't aren't wasn't one two three first second third also however therefore thus moreover furthermore`.split(/\s+/u));

function stem(word: string) {
  return word
    .replace(/(ies)$/u, "y")
    .replace(/(ssion|tion|ment|ness|able|ibly|ings|ed|ing|ly|es|s)$/u, "")
    .replace(/([^aeiou])y$/u, "$1");
}

function contentTokens(text: string) {
  return tokenize(text)
    .map((word) => stem(word.toLowerCase()))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word) && !/^\d+$/u.test(word));
}

function termFrequency(tokens: string[]) {
  const tf = new Map<string, number>();
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
  return tf;
}

function normalize(vector: Map<string, number>) {
  let sum = 0;
  for (const value of vector.values()) sum += value * value;
  const magnitude = Math.sqrt(sum);
  if (magnitude === 0) return vector;
  for (const [key, value] of vector) vector.set(key, value / magnitude);
  return vector;
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let total = 0;
  for (const [key, value] of small) {
    const other = large.get(key);
    if (other !== undefined) total += value * other;
  }
  return total;
}

/** Ranks sentences; exported so the UI can show why a line survived. */
export function rankSentences(text: string): SentenceScore[] {
  const paragraphs = splitParagraphs(text);
  const flat: { text: string; start: number; end: number; position: number; paragraphShare: number }[] = [];
  let position = 0;
  for (const paragraph of paragraphs) {
    const spans = splitSentences(paragraph.text);
    spans.forEach((span) => {
      flat.push({
        text: span.text,
        start: paragraph.start + span.start,
        end: paragraph.start + span.end,
        position: position,
        paragraphShare: 1 / Math.max(1, spans.length),
      });
      position += 1;
    });
  }
  if (flat.length === 0) return [];

  const sentenceTerms = flat.map((item) => termFrequency(contentTokens(item.text)));
  const documentCount = sentenceTerms.length;
  const documentFrequency = new Map<string, number>();
  for (const tf of sentenceTerms) {
    for (const term of tf.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const idf = (term: string) => Math.log(1 + documentCount / (documentFrequency.get(term) ?? 1));

  const weighted = sentenceTerms.map((tf) => {
    const vector = new Map<string, number>();
    const max = Math.max(1, ...tf.values());
    for (const [term, count] of tf) vector.set(term, (0.5 + 0.5 * (count / max)) * idf(term));
    return normalize(vector);
  });

  const centroid = new Map<string, number>();
  for (const vector of weighted) {
    for (const [term, value] of vector) centroid.set(term, (centroid.get(term) ?? 0) + value / weighted.length);
  }
  normalize(centroid);

  const lengths = flat.map((item) => countWords(item.text));
  const meanLength = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;

  return flat.map((item, index) => {
    const similarity = cosine(weighted[index], centroid);
    const length = lengths[index] ?? 0;
    // Penalise outliers in both directions: fragments and walls of text.
    const lengthFit = 1 - Math.min(1, Math.abs(length - meanLength) / Math.max(meanLength * 2, 1));
    const positionPrior = 1 - 0.35 * (item.position / Math.max(1, flat.length - 1));
    const leadBonus = item.paragraphShare >= 0.49 ? 0.06 : 0;
    const score = similarity * (0.55 + 0.25 * lengthFit) * positionPrior + leadBonus;
    return { index, text: item.text, start: item.start, end: item.end, score, selected: false };
  });
}

/** A bullet reads better without a trailing subordinate clause or a leading "However,". */
const KEY_POINT_MAX = 180;

/**
 * Longest prefix of `text` that still ends on a clause or word boundary. Kept as a
 * contiguous span of the input: a clipped point must be wording the document used.
 */
function clipToBoundary(text: string, max: number) {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const clause = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "));
  const cut = clause >= 40 ? window.slice(0, clause) : window.slice(0, window.lastIndexOf(" "));
  return `${cut.replace(/[,;:\s]+$/u, "")}…`;
}

function keyPointOf(sentence: string) {
  const trimmed = sentence
    .replace(/^\s*(?:however|therefore|moreover|furthermore|additionally|but|and|so)\s*[,\s]/iu, "")
    .split(/\s+(?:which|because|although|whereas|while)\s+/iu)[0] ?? sentence;
  const clean = clipToBoundary(trimmed.replace(/[,;:]\s*$/u, "").trim(), KEY_POINT_MAX);
  return clean.endsWith("…") || /[.!?]$/u.test(clean) ? clean : `${clean}.`;
}

/** Frequency x spread across paragraphs, which is a real rarity measure. */
export function extractKeywords(text: string, limit = 8) {
  const paragraphs = splitParagraphs(text);
  const total = tokenize(text).length;
  if (total === 0) return [];
  const counts = new Map<string, number>();
  const surface = new Map<string, string>();
  const spread = new Map<string, number>();
  // Keywords are reported as the surface form a reader typed, not as a stem.
  for (const raw of tokenize(text)) {
    const word = raw.toLowerCase();
    if (word.length < 3 || STOPWORDS.has(word) || /^\d+$/u.test(word)) continue;
    const stemmed = stem(word);
    if (stemmed.length < 3) continue;
    counts.set(stemmed, (counts.get(stemmed) ?? 0) + 1);
    const current = surface.get(stemmed);
    if (!current || word.length > current.length) surface.set(stemmed, word);
  }
  for (const paragraph of paragraphs) {
    const seen = new Set(contentTokens(paragraph.text));
    for (const term of seen) spread.set(term, (spread.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([term, count]) => {
      const appearingIn = spread.get(term) ?? 1;
      const rarity = Math.log(1 + paragraphs.length / appearingIn);
      return { term, word: surface.get(term) ?? term, score: count * (0.4 + rarity) };
    })
    .filter((entry) => entry.score > 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.word);
}

export function summarize(text: string, options: SummarizerOptions): SummaryResult {
  const format: SummaryFormat = options.format ?? "paragraph";
  const ranked = rankSentences(text);
  const target = clamp(Math.round(Number.isFinite(options.length) ? options.length : 3), 1, Math.max(1, ranked.length));

  // MMR-style selection: each pick is the most useful sentence left, its own score
  // discounted by how much it repeats what has already been chosen. Redundancy has
  // to cost rank rather than remove the candidate — in a topical document nearly
  // every sentence shares words with the one above it, and a hard "skip anything
  // similar" gate returns one sentence when five were asked for.
  const vectors = ranked.map((item) => termFrequency(contentTokens(item.text)));
  const overlap = (a: number, b: number) => cosine(vectors[a], vectors[b]);
  const remaining = ranked.map((item) => item.index);
  const chosen: number[] = [];
  while (chosen.length < target && remaining.length > 0) {
    let best = 0;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (let candidate = 0; candidate < remaining.length; candidate += 1) {
      const index = remaining[candidate];
      const repeats =
        chosen.length === 0
          ? 0
          : Math.max(...chosen.map((taken) => overlap(taken, index)));
      const value = ranked[index].score * (1 - 0.6 * repeats);
      if (value > bestValue) {
        bestValue = value;
        best = candidate;
      }
    }
    chosen.push(remaining[best]);
    remaining.splice(best, 1);
  }
  chosen.sort((a, b) => a - b);
  const picked = chosen.map((index) => ranked[index]);
  const summary = picked.map((item) => item.text.trim()).join(" ");

  const keyPoints = picked.map((item) => keyPointOf(item.text));
  const findings = picked.map((item) => clipToBoundary(item.text.trim(), KEY_POINT_MAX));
  const words = countWords(text);
  const compressionRatio = words === 0 ? 1 : Math.round((countWords(summary) / words) * 1000) / 1000;

  return {
    summary,
    keyPoints: format === "key-points" ? keyPoints : findings,
    keywords: extractKeywords(text),
    format,
    compressionRatio,
  };
}

export const SUMMARY_LENGTH_CHOICES: { label: string; sentences: number }[] = [
  { label: "One line", sentences: 1 },
  { label: "Short", sentences: 3 },
  { label: "Medium", sentences: 5 },
  { label: "Detailed", sentences: 8 },
];


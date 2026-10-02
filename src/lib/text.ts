/**
 * Text primitives shared by the detection engine, the services and the UI.
 * Deliberately dependency-free so they behave identically in browser and node.
 */

export interface CharSpan {
  text: string;
  start: number;
  end: number;
}

const SENTENCE_BOUNDARY = /[^.!?\n]+(?:[.!?]+["'”’)\]]*)?\s*|[^.!?\n]+$/gu;

export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n{3,} */g, "\n\n")
    .trim();
}

export function splitParagraphs(text: string): CharSpan[] {
  const out: CharSpan[] = [];
  const pattern = /\S[^]*?(?=\n\s*\n|$)/g;
  let cursor = 0;
  while (cursor < text.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(text);
    if (!match || match.index === undefined) break;
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const start = match.index + lead;
      out.push({ text: trimmed, start, end: start + trimmed.length });
    }
    cursor = match.index + Math.max(raw.length, 1);
  }
  return out;
}

/**
 * Sentence segmentation that keeps character offsets into the source text,
 * so the editor can highlight spans without re-parsing.
 */
export function splitSentences(text: string): CharSpan[] {
  const spans: CharSpan[] = [];
  let offset = 0;
  while (offset < text.length) {
    SENTENCE_BOUNDARY.lastIndex = offset;
    const match = SENTENCE_BOUNDARY.exec(text);
    if (!match) break;
    const raw = match[0];
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const start = match.index + (raw.length - raw.trimStart().length);
      spans.push({ text: trimmed, start, end: start + trimmed.length });
    }
    if (match.index === SENTENCE_BOUNDARY.lastIndex) SENTENCE_BOUNDARY.lastIndex += 1;
    offset = SENTENCE_BOUNDARY.lastIndex;
  }
  return spans;
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’\-_]*/gu;

/** A word with the offsets it occupies, so a change can be pointed at in place. */
export interface TokenSpan {
  text: string;
  start: number;
  end: number;
}

export function tokenSpans(text: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  WORD.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD.exec(text)) !== null) {
    spans.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

export function tokenize(text: string): string[] {
  return text.match(WORD) ?? [];
}

export function countWords(text: string) {
  let count = 0;
  WORD.lastIndex = 0;
  while (WORD.exec(text) !== null) count += 1;
  return count;
}

export function countCharacters(text: string, includeSpaces = true) {
  return includeSpaces ? text.length : text.replace(/\s/g, "").length;
}

/** ~238 wpm for narrative prose, the convention used by reading-time widgets. */
export function readingTimeSeconds(words: number) {
  return Math.round((words / 238) * 60);
}

export function uniqueWords(text: string) {
  return new Set(tokenize(text).map((w) => w.toLowerCase())).size;
}

/** Vowel-group heuristic; adequate for readability indexing, not a dictionary. */
export function estimateSyllables(text: string) {
  let total = 0;
  for (const word of tokenize(text.toLowerCase())) {
    const groups = word.match(/[aeiouy]+/gu);
    let count = groups?.length ?? 1;
    // Silent finals: landscape, tracked — but not wanted/needed, where the e is spoken.
    if (count > 1 && /[^l]e$/u.test(word)) count -= 1;
    if (count > 1 && word.length > 4 && /[^aeiou]ed$/u.test(word) && !/[td]ed$/u.test(word)) count -= 1;
    // Ensures, outcomes — the -es ending of a plural or third person adds nothing.
    if (count > 1 && word.length > 4 && /[^aeiousd]es$/u.test(word)) count -= 1;
    total += Math.max(1, count);
  }
  return total;
}

/**
 * Flesch Reading Ease on its conventional scale, which runs below zero for dense
 * prose and above 100 for very short sentences. The raw value is returned so a
 * before/after pair never collapses onto the same clamped floor.
 */
export function fleschReadingEase(text: string) {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  const sentences = Math.max(1, splitSentences(text).length);
  const syllables = Math.max(words.length, estimateSyllables(text));
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.round(score);
}

export function readabilityLabel(score: number) {
  if (score >= 80) return "Very easy";
  if (score >= 65) return "Plain English";
  if (score >= 55) return "Fairly readable";
  if (score >= 40) return "Considered";
  if (score >= 20) return "Difficult";
  return "Very difficult";
}

export function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1),
  );
}

/** Type-token ratio over the whole document. */
export function lexicalDiversity(text: string) {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  return uniqueWords(text) / words.length;
}

export function truncate(text: string, max = 140) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function titleFromText(text: string, fallback = "Untitled document") {
  const firstLine = normalizeText(text).split("\n")[0]?.trim() ?? "";
  if (!firstLine) return fallback;
  return truncate(firstLine, 48);
}

/** Deterministic pseudo-random from a string, so demo scores never flicker. */
export function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

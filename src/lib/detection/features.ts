import {
  countWords,
  estimateSyllables,
  lexicalDiversity,
  mean,
  normalizeText,
  splitParagraphs,
  splitSentences,
  stdDev,
  tokenize,
  uniqueWords,
} from "@/lib/text";

const TRANSITION_PHRASES = [
  "moreover",
  "furthermore",
  "in addition",
  "additionally",
  "in conclusion",
  "to conclude",
  "to summarize",
  "in summary",
  "it is important to note",
  "it is worth noting",
  "in today's world",
  "in this day and age",
  "consequently",
  "therefore",
  "thus",
  "hence",
  "nevertheless",
  "nonetheless",
  "on the other hand",
  "first and foremost",
  "when it comes to",
  "in essence",
  "ultimately",
  "overall,",
  "firstly",
  "secondly",
  "lastly",
];

const HEDGES = [
  "perhaps",
  "maybe",
  "possibly",
  "somewhat",
  "generally",
  "typically",
  "usually",
  "often",
  "arguably",
  "presumably",
  "relatively",
  "considerably",
  "significantly",
  "substantially",
  "essentially",
  "potentially",
  "facilitate",
  "delve",
  "leverage",
  "holistic",
  "robust",
  "seamless",
  "comprehensive",
  "nuanced",
];

const COLLOQUIAL = [
  "stuff",
  "things",
  "kind of",
  "sort of",
  "a lot",
  "honestly",
  "actually",
  "basically",
  "really",
  "pretty",
  "gonna",
  "wanna",
  "yeah",
  "okay",
  "big deal",
  "a bunch",
  "figured",
  "guess",
  "though",
  "anyway",
];

const FUNCTION_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this",
  "these", "those", "of", "to", "in", "on", "at", "by", "for", "with", "about",
  "as", "into", "like", "through", "after", "over", "between", "out", "against",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did",
  "have", "has", "had", "having", "will", "would", "shall", "should", "can",
  "could", "may", "might", "must", "it", "its", "he", "she", "they", "them",
  "his", "her", "their", "we", "you", "i", "me", "my", "our", "your", "from",
  "so", "because", "while", "where", "when", "who", "which", "what", "there",
  "here", "also", "not", "no", "yes", "some", "any", "each", "few", "more",
  "most", "other", "own", "same", "such", "only", "just", "very", "too",
]);

const FIRST_PERSON = /\b(i|me|my|mine|myself|we|our|ours|us)\b/gi;
const CONTRACTION =
  /\b\w+(?:n't|'re|'ve|'ll|'d)\b|\b(?:i'm|it's|that's|there's|here's|what's|who's|let's)\b/gi;
const EM_DASH = /—/g;

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) !== null) n += 1;
  return n;
}

function countPhraseHits(haystack: string, phrases: string[]): number {
  let n = 0;
  for (const p of phrases) {
    let idx = haystack.indexOf(p);
    while (idx !== -1) {
      n += 1;
      idx = haystack.indexOf(p, idx + p.length);
    }
  }
  return n;
}

function openingNgram(tokens: string[], n: number): string {
  return tokens.slice(0, n).join(" ").toLowerCase();
}

export interface SentenceFeature {
  text: string;
  start: number;
  end: number;
  paragraphIndex: number;
  wordCount: number;
  syllableEstimate: number;
  avgSyllablesPerWord: number;
  /** Signed deviation of this sentence's length from the document mean, in SD units. */
  lengthZ: number;
  transitionHits: number;
  hedgeHits: number;
  firstPersonHits: number;
  contractionHits: number;
  colloquialHits: number;
  emDashHits: number;
  openingWord: string;
  isParallelOpening: boolean;
  isFragment: boolean;
}

export interface TextFeatures {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  /** Coefficient of variation of sentence lengths; low values imply metronomic cadence. */
  burstiness: number;
  avgAbsLengthDeviation: number;
  punctuationVariety: number;
  transitionRate: number;
  hedgeRate: number;
  parallelOpeningRate: number;
  openingRepetitionRate: number;
  initialTrigramRepeatRate: number;
  repeatedBigramRate: number;
  rareWordRatio: number;
  functionWordRatio: number;
  avgSyllablesPerWord: number;
  firstPersonRate: number;
  colloquialRate: number;
  contractionRate: number;
  emDashRate: number;
  typographicIrregularity: number;
  lexicalDiversity: number;
  uniqueWordCount: number;
  sentences: SentenceFeature[];
}

export function extractFeatures(rawText: string): TextFeatures {
  const text = normalizeText(rawText);
  const paragraphs = splitParagraphs(text);
  const sentences: SentenceFeature[] = [];
  const lengths: number[] = [];

  for (let p = 0; p < paragraphs.length; p += 1) {
    const para = paragraphs[p];
    const spans = splitSentences(para.text);
    for (const span of spans) {
      const tokens = tokenize(span.text);
      const wordCount = tokens.length;
      const syllables = estimateSyllables(span.text);
      const lower = ` ${span.text.toLowerCase()} `;
      sentences.push({
        text: span.text,
        start: para.start + span.start,
        end: para.start + span.end,
        paragraphIndex: p,
        wordCount,
        syllableEstimate: syllables,
        avgSyllablesPerWord: wordCount > 0 ? syllables / wordCount : 0,
        lengthZ: 0,
        transitionHits: countPhraseHits(lower, TRANSITION_PHRASES),
        hedgeHits: countPhraseHits(lower, HEDGES),
        firstPersonHits: countMatches(span.text, FIRST_PERSON),
        contractionHits: countMatches(span.text, CONTRACTION),
        colloquialHits: countPhraseHits(lower, COLLOQUIAL),
        emDashHits: countMatches(span.text, EM_DASH),
        openingWord: tokens[0]?.toLowerCase() ?? "",
        isParallelOpening: false,
        isFragment: wordCount < 4,
      });
      lengths.push(wordCount);
    }
  }

  const meanLen = mean(lengths);
  const sdLen = stdDev(lengths);
  for (const s of sentences) {
    s.lengthZ = sdLen > 0 ? (s.wordCount - meanLen) / sdLen : 0;
  }
  for (let i = 1; i < sentences.length; i += 1) {
    const prev = sentences[i - 1];
    const cur = sentences[i];
    if (prev.openingWord && prev.openingWord === cur.openingWord) cur.isParallelOpening = true;
  }

  const allTokens = tokenize(text);
  const wordCount = allTokens.length || countWords(text);
  const sentenceCount = sentences.length || 1;
  const lowerTokens = allTokens.map((t) => t.toLowerCase());

  const bigrams = new Map<string, number>();
  for (let i = 0; i + 1 < lowerTokens.length; i += 1) {
    const key = `${lowerTokens[i]} ${lowerTokens[i + 1]}`;
    bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
  }
  let repeatedBigrams = 0;
  let totalBigrams = 0;
  for (const c of bigrams.values()) {
    totalBigrams += c;
    if (c > 1) repeatedBigrams += c;
  }

  const openings = new Set<string>();
  const trigrams = new Map<string, number>();
  for (const s of sentences) {
    if (s.openingWord) openings.add(s.openingWord);
    const key = openingNgram(tokenize(s.text), 3);
    if (key) trigrams.set(key, (trigrams.get(key) ?? 0) + 1);
  }
  let trigramRepeats = 0;
  for (const [key, c] of trigrams) {
    if (c > 1 && key.split(" ").length === 3) trigramRepeats += c - 1;
  }

  const parallelOpenings = sentences.filter((s) => s.isParallelOpening).length;
  const transitionSentences = sentences.filter((s) => s.transitionHits > 0).length;
  const hedgeTotal = sentences.reduce((n, s) => n + s.hedgeHits, 0);
  const firstPersonTotal = sentences.reduce((n, s) => n + s.firstPersonHits, 0);
  const contractionTotal = sentences.reduce((n, s) => n + s.contractionHits, 0);
  const colloquialTotal = sentences.reduce((n, s) => n + s.colloquialHits, 0);
  const emDashTotal = sentences.reduce((n, s) => n + s.emDashHits, 0);
  const syllableTotal = allTokens.length > 0 ? estimateSyllables(text) : 0;
  const functionCount = lowerTokens.filter((t) => FUNCTION_WORDS.has(t)).length;
  const rareCount = lowerTokens.filter((t) => t.length >= 8).length;

  const punctuation = text.match(/[.,;:!?—\-()"'“”‘’]/g) ?? [];
  const punctuationKinds = new Set(punctuation.map((c) => (c === "—" ? "-" : c)));
  const avgAbsDev = mean(sentences.map((s) => Math.abs(s.lengthZ)));

  return {
    wordCount,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    avgSentenceLength: meanLen,
    sentenceLengthStdDev: sdLen,
    burstiness: meanLen > 0 ? sdLen / meanLen : 0,
    avgAbsLengthDeviation: avgAbsDev,
    punctuationVariety: punctuation.length > 0 ? punctuationKinds.size / 8 : 0,
    transitionRate: transitionSentences / sentenceCount,
    hedgeRate: wordCount > 0 ? hedgeTotal / (wordCount / 100) : 0,
    parallelOpeningRate: parallelOpenings / sentenceCount,
    openingRepetitionRate: 1 - openings.size / sentenceCount,
    initialTrigramRepeatRate: trigramRepeats / sentenceCount,
    repeatedBigramRate: totalBigrams > 0 ? repeatedBigrams / totalBigrams : 0,
    rareWordRatio: allTokens.length > 0 ? rareCount / allTokens.length : 0,
    functionWordRatio: allTokens.length > 0 ? functionCount / allTokens.length : 0,
    avgSyllablesPerWord: allTokens.length > 0 ? syllableTotal / allTokens.length : 0,
    firstPersonRate: wordCount > 0 ? firstPersonTotal / (wordCount / 100) : 0,
    colloquialRate: wordCount > 0 ? colloquialTotal / (wordCount / 100) : 0,
    contractionRate: wordCount > 0 ? contractionTotal / (wordCount / 100) : 0,
    emDashRate: wordCount > 0 ? emDashTotal / (wordCount / 100) : 0,
    typographicIrregularity:
      wordCount > 0 ? (contractionTotal + emDashTotal) / (wordCount / 100) : 0,
    lexicalDiversity: lexicalDiversity(text),
    uniqueWordCount: uniqueWords(text),
    sentences,
  };
}

/** Reference distributions for each feature taken from mixed human/assistant corpora. */
export const CORPUS_DEFAULTS: Record<keyof Omit<TextFeatures, "sentences">, { mean: number; std: number }> = {
  wordCount: { mean: 260, std: 200 },
  sentenceCount: { mean: 11, std: 8 },
  paragraphCount: { mean: 3, std: 2 },
  avgSentenceLength: { mean: 17, std: 7 },
  sentenceLengthStdDev: { mean: 8, std: 5 },
  burstiness: { mean: 0.5, std: 0.22 },
  avgAbsLengthDeviation: { mean: 0.85, std: 0.35 },
  punctuationVariety: { mean: 0.45, std: 0.18 },
  transitionRate: { mean: 0.16, std: 0.16 },
  hedgeRate: { mean: 1.4, std: 1.2 },
  parallelOpeningRate: { mean: 0.14, std: 0.14 },
  openingRepetitionRate: { mean: 0.24, std: 0.2 },
  initialTrigramRepeatRate: { mean: 0.05, std: 0.08 },
  repeatedBigramRate: { mean: 0.1, std: 0.09 },
  rareWordRatio: { mean: 0.09, std: 0.05 },
  functionWordRatio: { mean: 0.45, std: 0.08 },
  avgSyllablesPerWord: { mean: 1.5, std: 0.2 },
  firstPersonRate: { mean: 2.2, std: 2.4 },
  colloquialRate: { mean: 1.6, std: 1.6 },
  contractionRate: { mean: 2.0, std: 2.6 },
  emDashRate: { mean: 0.6, std: 1.0 },
  typographicIrregularity: { mean: 2.6, std: 2.8 },
  lexicalDiversity: { mean: 0.55, std: 0.1 },
  uniqueWordCount: { mean: 150, std: 110 },
};

export type NormalizedFeatures = Record<keyof Omit<TextFeatures, "sentences">, number>;

/** Convert raw features into clamped z-scores so documents of any size compare fairly. */
export function normalizeFeatures(features: TextFeatures): NormalizedFeatures {
  const out = {} as NormalizedFeatures;
  for (const key of Object.keys(CORPUS_DEFAULTS) as (keyof Omit<TextFeatures, "sentences">)[]) {
    const ref = CORPUS_DEFAULTS[key];
    const raw = Number(features[key]);
    const z = ref.std > 0 ? (raw - ref.mean) / ref.std : 0;
    out[key] = Math.max(-3, Math.min(3, z));
  }
  return out;
}

export { TRANSITION_PHRASES, HEDGES, COLLOQUIAL };

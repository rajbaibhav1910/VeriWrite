import { CLASSIFICATION_LABEL, CONFIDENCE_LABEL, formatNumber } from "@/lib/utils";
import { bandFor } from "./model";
import type {
  Classification,
  ConfidenceLevel,
  DetectionResult,
  SentenceAnalysis,
  SignalKind,
} from "@/types";

/**
 * Every number the analytics panel draws comes from a finished `DetectionResult`.
 * Nothing here measures text a second time: a chart that disagreed with the score
 * ring would be worse than no chart at all, so the series are projections of the
 * engine's own fields plus one tally that runs through the engine's band rule.
 */

export interface SentencePoint {
  /** The engine's sentence number, used for selection and for the axis label. */
  index: number;
  /** "42%" — what the bar is labelled with in tooltips and the text alternative. */
  aiLabel: string;
  aiProbability: number;
  humanProbability: number;
  /** Words in the sentence; the axis of the length chart. */
  wordCount: number;
  flagged: boolean;
  confidence: ConfidenceLevel;
  signal: SignalKind;
  classification: Classification;
}

export interface ParagraphPoint {
  index: number;
  aiProbability: number;
  /** Words counted from the paragraph's own text, so the bar can say how it got there. */
  wordCount: number;
  sentences: number;
  signal: SignalKind;
  confidence: ConfidenceLevel;
  /** First sentence of the paragraph, so clicking a bar opens that sentence. */
  firstSentenceIndex: number;
  /** Shortened paragraph opening for the tooltip and the text alternative. */
  preview: string;
}

export interface StyleSlice {
  classification: Classification;
  /** Percent of the document's words, straight from the engine's breakdown. */
  share: number;
  sentences: number;
  words: number;
}

export interface AnalyticsMetric {
  label: string;
  value: string;
  /** What the figure is measured against, in a few words. */
  note: string;
}

export interface Analytics {
  sentences: SentencePoint[];
  paragraphs: ParagraphPoint[];
  styles: StyleSlice[];
  metrics: AnalyticsMetric[];
  /** Sentence-length summary, taken from the engine rather than recomputed. */
  length: {
    mean: number;
    stdDev: number;
    /** 0-1 relative variation, the engine's own burstiness figure. */
    burstiness: number;
    shortest: number;
    longest: number;
  };
  /** Smallest and largest paragraph estimate, to say how flat the paragraph chart is. */
  paragraphSpread: { min: number; max: number } | null;
  /** True when every paragraph sits within a few points of the document figure. */
  paragraphsClose: boolean;
}

const CLASS_ORDER: Classification[] = [
  "ai_generated",
  "ai_generated_refined",
  "human_refined",
  "human_written",
];

function wordsOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function previewOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 57).trimEnd()}...` : flat;
}

/**
 * Sentences per class and words per class, using the exported band table. This is
 * the same rule the breakdown cards and the sentence filters use, so a bar in the
 * style chart cannot count a sentence into a class the filter would hide.
 */
export function tallyByBand(
  sentences: SentenceAnalysis[],
): Record<Classification, { sentences: number; words: number }> {
  const tally = {
    ai_generated: { sentences: 0, words: 0 },
    ai_generated_refined: { sentences: 0, words: 0 },
    human_refined: { sentences: 0, words: 0 },
    human_written: { sentences: 0, words: 0 },
  } as Record<Classification, { sentences: number; words: number }>;
  for (const sentence of sentences) {
    const band = tally[bandFor(sentence.aiProbability)];
    band.sentences += 1;
    band.words += sentence.wordCount;
  }
  return tally;
}

export function buildAnalytics(result: DetectionResult): Analytics {
  const sentencePoints: SentencePoint[] = result.sentences.map((sentence) => ({
    index: sentence.index,
    aiLabel: `${Math.round(sentence.aiProbability)}%`,
    aiProbability: sentence.aiProbability,
    humanProbability: sentence.humanProbability,
    wordCount: sentence.wordCount,
    flagged: sentence.flagged,
    confidence: sentence.confidence,
    signal: sentence.signal,
    classification: bandFor(sentence.aiProbability),
  }));

  const paragraphPoints: ParagraphPoint[] = result.paragraphs.map((paragraph) => {
    const firstSentence = paragraph.sentenceIndices[0];
    return {
      index: paragraph.index,
      aiProbability: paragraph.aiProbability,
      wordCount: wordsOf(paragraph.text),
      sentences: paragraph.sentenceIndices.length,
      signal: paragraph.signal,
      confidence: paragraph.confidence,
      firstSentenceIndex: typeof firstSentence === "number" ? firstSentence : 0,
      preview: previewOf(paragraph.text),
    };
  });

  const tally = tallyByBand(result.sentences);
  const styles: StyleSlice[] = CLASS_ORDER.map((classification) => ({
    classification,
    share: result.breakdown[classification],
    sentences: tally[classification].sentences,
    words: tally[classification].words,
  }));

  const wordCounts = result.sentences.map((sentence) => sentence.wordCount);
  const shortest = wordCounts.length > 0 ? Math.min(...wordCounts) : 0;
  const longest = wordCounts.length > 0 ? Math.max(...wordCounts) : 0;

  const paragraphSpread =
    paragraphPoints.length > 0
      ? {
          min: Math.min(...paragraphPoints.map((p) => p.aiProbability)),
          max: Math.max(...paragraphPoints.map((p) => p.aiProbability)),
        }
      : null;

  const metrics: AnalyticsMetric[] = [
    {
      label: "AI likelihood",
      value: `${Math.round(result.aiProbability)}%`,
      note: "Estimated, not proof of authorship",
    },
    {
      label: "Human likelihood",
      value: `${Math.round(result.humanProbability)}%`,
      note: "The rest of the same measurement",
    },
    {
      label: "Confidence",
      value: CONFIDENCE_LABEL[result.confidence],
      note: "Rises with the amount of text read",
    },
    { label: "Words", value: formatNumber(result.metrics.words), note: "In the analysed text" },
    {
      label: "Characters",
      value: formatNumber(result.metrics.characters),
      note: "Including spaces",
    },
    {
      label: "Sentences",
      value: formatNumber(result.metrics.sentences),
      note: `${formatNumber(result.sentences.filter((s) => s.flagged).length)} flagged`,
    },
    {
      label: "Paragraphs",
      value: formatNumber(result.metrics.paragraphs),
      note: "Blocks separated by a blank line",
    },
    {
      label: "Average sentence length",
      value: `${result.metrics.averageSentenceLength.toFixed(1)} words`,
      note: `Spread ${result.metrics.sentenceLengthStdDev.toFixed(1)} words around it`,
    },
    {
      label: "Vocabulary diversity",
      value: `${(result.metrics.vocabularyDiversity * 100).toFixed(0)}%`,
      note: `${formatNumber(result.metrics.uniqueWords)} distinct words`,
    },
    {
      label: "Readability",
      value: result.metrics.readabilityLabel || "—",
      note: `Flesch score ${result.metrics.readabilityScore.toFixed(0)}`,
    },
  ];

  return {
    sentences: sentencePoints,
    paragraphs: paragraphPoints,
    styles,
    metrics,
    length: {
      mean: result.metrics.averageSentenceLength,
      stdDev: result.metrics.sentenceLengthStdDev,
      burstiness: result.metrics.burstiness,
      shortest,
      longest,
    },
    paragraphSpread,
    paragraphsClose:
      paragraphSpread !== null &&
      paragraphPoints.length > 1 &&
      paragraphSpread.max - paragraphSpread.min <= 10,
  };
}

/** The chart's own honest caveat, in the words the panel shows under the paragraph bars. */
export function paragraphFlatNote(analytics: Analytics): string {
  if (analytics.paragraphs.length === 0) return "No paragraphs were reported for this text.";
  if (analytics.paragraphs.length === 1) {
    return "Only one paragraph was measured, so this chart has a single bar. A paragraph chart says something only when the text is split into blocks.";
  }
  const { min, max } = analytics.paragraphSpread ?? { min: 0, max: 0 };
  if (analytics.paragraphsClose) {
    return `The paragraphs stay within ${max - min} points of each other (${min}% to ${max}%). A flat line here means the engine read the blocks as similar, not that it failed to look.`;
  }
  return `Paragraph estimates run from ${min}% to ${max}%, so the blocks do differ here.`;
}

/** One line per bar, for screen readers and for the case where the SVG cannot draw. */
export function sentenceSeriesSummary(analytics: Analytics): string {
  if (analytics.sentences.length === 0) return "No sentences were scored.";
  return analytics.sentences
    .map(
      (point) =>
        `Sentence ${point.index + 1}: ${point.aiLabel} AI, ${point.wordCount} words, ${
          CLASSIFICATION_LABEL[point.classification]
        }${point.flagged ? ", flagged" : ""}.`,
    )
    .join(" ");
}

export function paragraphSeriesSummary(analytics: Analytics): string {
  if (analytics.paragraphs.length === 0) return "No paragraphs were scored.";
  return analytics.paragraphs
    .map(
      (point) =>
        `Paragraph ${point.index + 1}: ${Math.round(point.aiProbability)}% AI across ${
          point.sentences
        } sentences and ${point.wordCount} words.`,
    )
    .join(" ");
}

export function lengthSeriesSummary(analytics: Analytics): string {
  if (analytics.sentences.length === 0) return "No sentences were measured.";
  return `Sentence lengths in words: ${analytics.sentences
    .map((point) => `${point.index + 1}=${point.wordCount}`)
    .join(", ")}. Average ${analytics.length.mean.toFixed(1)}, spread ${analytics.length.stdDev.toFixed(
    1,
  )} words around it.`;
}

export function styleSeriesSummary(analytics: Analytics): string {
  return analytics.styles
    .filter((slice) => slice.share > 0)
    .map(
      (slice) =>
        `${CLASSIFICATION_LABEL[slice.classification]} ${slice.share}% of the words (${
          slice.sentences
        } sentences, ${slice.words} words).`,
    )
    .join(" ") || "No class took a measurable share of the words.";
}

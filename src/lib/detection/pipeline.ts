import { ApiError } from "@/lib/api";
import {
  countCharacters,
  countWords,
  estimateSyllables,
  fleschReadingEase,
  normalizeText,
  readabilityLabel,
  readingTimeSeconds,
  splitParagraphs,
  splitSentences,
  type CharSpan,
} from "@/lib/text";
import { MAX_WORDS, MIN_WORDS, uid } from "@/lib/utils";
import type {
  ConfidenceLevel,
  DetectedSignal,
  DetectionResult,
  DocumentMetrics,
  LanguageCode,
  ParagraphAnalysis,
  SentenceAnalysis,
} from "@/types";
import { extractFeatures, normalizeFeatures, type TextFeatures } from "./features";
import {
  getDefaultModel,
  type DetectionModel,
  type SentenceInput,
  type SentenceScore,
} from "./model";

export interface PipelineOptions {
  language?: LanguageCode;
  model?: DetectionModel;
  seed?: string;
  documentId?: string;
}

export interface SentenceSegment extends CharSpan {
  paragraphIndex: number;
}

export interface Segmentation {
  paragraphs: CharSpan[];
  sentences: SentenceSegment[];
}

export function validateInput(text: string): void {
  const words = countWords(text);
  if (words < MIN_WORDS) {
    throw new ApiError(
      "text_too_short",
      `Add at least ${MIN_WORDS} words before running a detection.`,
      "Longer passages give the detector enough signal to say anything useful.",
    );
  }
  if (words > MAX_WORDS) {
    throw new ApiError(
      "text_too_long",
      `That is ${words} words; the limit for a single analysis is ${MAX_WORDS}.`,
      "Split the document into shorter sections and analyse them separately.",
    );
  }
}

export function normalizeInput(text: string): string {
  return normalizeText(text);
}

const STOPWORDS: Partial<Record<LanguageCode, string[]>> = {
  en: ["the", "and", "of", "to", "is", "in", "that", "for", "it", "with"],
  es: ["de", "que", "el", "y", "a", "la", "por", "un", "para", "con"],
  fr: ["le", "et", "des", "un", "à", "est", "que", "dans", "pour", "la"],
  de: ["der", "und", "die", "das", "ist", "von", "zu", "mit", "auf", "für"],
  pt: ["de", "que", "e", "é", "a", "os", "no", "uma", "para", "com"],
  it: ["di", "che", "il", "e", "per", "con", "la", "un", "del", "sono"],
  nl: ["de", "het", "een", "van", "en", "is", "in", "dat", "op", "met"],
};

const SCRIPTS: Partial<Record<LanguageCode, RegExp>> = {
  zh: /[\u4e00-\u9fff]/,
  ja: /[\u3040-\u30ff]/,
  ko: /[\uac00-\ud7af]/,
  ru: /[\u0400-\u04ff]/,
  ar: /[\u0600-\u06ff]/,
  hi: /[\u0900-\u097f]/,
};

export function detectLanguageStage(text: string, forced?: LanguageCode): LanguageCode {
  if (forced) return forced;
  for (const [code, re] of Object.entries(SCRIPTS) as [LanguageCode, RegExp][]) {
    if (re.test(text)) return code;
  }
  const lower = ` ${text.toLowerCase()} `;
  let best: LanguageCode = "en";
  let bestHits = 0;
  for (const [code, words] of Object.entries(STOPWORDS) as [LanguageCode, string[]][]) {
    let hits = 0;
    for (const w of words) {
      if (lower.includes(` ${w} `)) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = code;
    }
  }
  return bestHits >= 2 ? best : "en";
}

export function segmentInput(text: string): Segmentation {
  const paragraphs = splitParagraphs(text);
  const sentences: SentenceSegment[] = [];
  for (let p = 0; p < paragraphs.length; p += 1) {
    const para = paragraphs[p];
    for (const span of splitSentences(para.text)) {
      sentences.push({
        text: span.text,
        start: para.start + span.start,
        end: para.start + span.end,
        paragraphIndex: p,
      });
    }
  }
  return { paragraphs, sentences };
}

export function featureStage(text: string): TextFeatures {
  return extractFeatures(text);
}

export function inferenceStage(
  model: DetectionModel,
  features: TextFeatures,
  seed: string,
): SentenceScore[] {
  const normalized = normalizeFeatures(features);
  return features.sentences.map((sentence, index) => {
    const input: SentenceInput = {
      index,
      paragraphIndex: sentence.paragraphIndex,
      features: sentence,
      documentFeatures: features,
      normalized,
      seed,
    };
    return model.analyzeSentence(input);
  });
}

/** Confidence is derived from evidence volume, agreement between sentences and distance from the decision boundary. */
export function confidenceStage(ai: number, features: TextFeatures, scores: SentenceScore[]): ConfidenceLevel {
  const margin = Math.abs(ai - 50);
  const spread = std(scores.map((s) => s.aiProbability));
  const volume =
    features.wordCount >= 400 ? 3 : features.wordCount >= 200 ? 2.2 : features.wordCount >= 80 ? 1.4 : features.wordCount >= 30 ? 0.8 : 0.3;
  const coverage = features.sentenceCount >= 8 ? 1 : features.sentenceCount >= 4 ? 0.5 : 0;
  const agreement = spread <= 8 ? 1.6 : spread <= 16 ? 1.1 : spread <= 26 ? 0.5 : 0;
  const boundary = margin >= 32 ? 1.5 : margin >= 18 ? 1 : margin >= 8 ? 0.5 : 0;
  const score = volume + coverage + agreement + boundary;
  if (score >= 5.5) return "very-high";
  if (score >= 4) return "high";
  if (score >= 2.2) return "moderate";
  return "low";
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

export function aggregateSentenceStage(
  segmentation: Segmentation,
  features: TextFeatures,
  scores: SentenceScore[],
): SentenceAnalysis[] {
  return segmentation.sentences.map((span, index) => {
    const score = scores[index];
    const sf = features.sentences[index];
    return {
      id: `sent_${uid("s").slice(2)}`,
      index,
      start: span.start,
      end: span.end,
      paragraphIndex: span.paragraphIndex,
      text: span.text,
      aiProbability: score.aiProbability,
      humanProbability: score.humanProbability,
      confidence: score.confidence,
      signal: score.signal,
      signals: score.signals,
      wordCount: sf?.wordCount ?? countWords(span.text),
      characterCount: countCharacters(span.text),
      syllableEstimate: sf?.syllableEstimate ?? estimateSyllables(span.text),
      flagged: score.flagged,
    };
  });
}

export function aggregateParagraphStage(
  model: DetectionModel,
  segmentation: Segmentation,
  features: TextFeatures,
  sentences: SentenceAnalysis[],
): ParagraphAnalysis[] {
  const normalized = normalizeFeatures(features);
  return segmentation.paragraphs.map((para, index) => {
    const members = sentences.filter((s) => s.paragraphIndex === index);
    const score = model.analyzeParagraph({
      index,
      text: para.text,
      sentenceScores: members.map((m) => ({
        aiProbability: m.aiProbability,
        humanProbability: m.humanProbability,
        confidence: m.confidence,
        signal: m.signal,
        signals: m.signals,
        flagged: m.flagged,
      })),
      sentenceWordCounts: members.map((m) => m.wordCount),
      normalized,
    });
    return {
      index,
      text: para.text,
      aiProbability: score.aiProbability,
      confidence: score.confidence,
      signal: score.signal,
      sentenceIndices: members.map((m) => m.index),
    };
  });
}

export function metricsStage(text: string, features: TextFeatures, sentences: SentenceAnalysis[]): DocumentMetrics {
  const words = countWords(text);
  const lengths = sentences.map((s) => s.wordCount);
  const readability = fleschReadingEase(text);
  return {
    words,
    characters: countCharacters(text),
    charactersNoSpaces: countCharacters(text, false),
    sentences: sentences.length,
    paragraphs: features.paragraphCount,
    averageSentenceLength: Math.round(features.avgSentenceLength * 100) / 100,
    sentenceLengthStdDev: Math.round(features.sentenceLengthStdDev * 100) / 100,
    vocabularyDiversity: Math.round(features.lexicalDiversity * 1000) / 1000,
    readabilityScore: readability,
    readabilityLabel: readabilityLabel(readability),
    burstiness: Math.round(features.burstiness * 1000) / 1000,
    readingTimeSeconds: readingTimeSeconds(words),
    longestSentence: lengths.length > 0 ? Math.max(...lengths) : 0,
    uniqueWords: features.uniqueWordCount,
  };
}

export function explainStage(documentSignals: DetectedSignal[], features: TextFeatures): DetectedSignal[] {
  const extra: DetectedSignal[] = [];
  if (features.burstiness < 0.35 && features.sentenceCount >= 4) {
    extra.push({
      name: "burstiness",
      weight: 0.5,
      confidence: features.sentenceCount >= 8 ? "moderate" : "low",
      explanation: "Sentence lengths stay close together across the document, which reads as an even cadence.",
    });
  }
  if (features.lexicalDiversity < 0.45 && features.wordCount >= 80) {
    extra.push({
      name: "lexical_diversity",
      weight: 0.4,
      confidence: "low",
      explanation: "The same words recur often here, a pattern shared by many kinds of writing.",
    });
  }
  const merged = [...documentSignals, ...extra];
  const seen = new Map<string, DetectedSignal>();
  for (const s of merged) {
    const current = seen.get(s.name);
    if (!current || s.weight > current.weight) seen.set(s.name, s);
  }
  return [...seen.values()].sort((a, b) => b.weight - a.weight).slice(0, 6);
}

export interface ResultAssembly {
  model: DetectionModel;
  normalized: string;
  language: LanguageCode;
  features: TextFeatures;
  segmentation: Segmentation;
  scores: SentenceScore[];
  startedAt: number;
  documentId?: string;
}

/** Single source of truth for turning stage outputs into a DetectionResult; shared by the sync pipeline and the staged service. */
export function assembleResult(input: ResultAssembly): DetectionResult {
  const { model, normalized, language, features, segmentation, scores, startedAt } = input;
  const sentences = aggregateSentenceStage(segmentation, features, scores);
  const paragraphs = aggregateParagraphStage(model, segmentation, features, sentences);
  const docScore = model.analyzeDocument({
    text: normalized,
    features,
    normalized: normalizeFeatures(features),
    sentenceScores: scores,
  });
  const confidence = confidenceStage(docScore.aiProbability, features, scores);
  const metrics = metricsStage(normalized, features, sentences);
  const signals = explainStage(docScore.signals, features);
  return {
    documentId: input.documentId ?? uid("doc"),
    analysisId: uid("an"),
    analyzedAt: new Date().toISOString(),
    language,
    aiProbability: docScore.aiProbability,
    humanProbability: docScore.humanProbability,
    confidence,
    classification: docScore.classification,
    breakdown: docScore.breakdown,
    sentences,
    paragraphs,
    metrics,
    signals,
    engine: model.id,
    engineVersion: model.version,
    processingMs: Math.max(1, Date.now() - startedAt),
  };
}

export function runDetectionPipeline(text: string, options: PipelineOptions = {}): DetectionResult {
  const startedAt = Date.now();
  validateInput(text);
  const normalized = normalizeInput(text);
  const language = detectLanguageStage(normalized, options.language);
  const model = options.model ?? getDefaultModel();
  const segmentation = segmentInput(normalized);
  const features = featureStage(normalized);
  const scores = inferenceStage(model, features, options.seed ?? normalized);
  return assembleResult({ model, normalized, language, features, segmentation, scores, startedAt, documentId: options.documentId });
}

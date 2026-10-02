import type {
  Classification,
  ClassificationBreakdown,
  ConfidenceLevel,
  DetectedSignal,
  SignalKind,
  SignalName,
} from "@/types";
import { clamp } from "@/lib/utils";
import { seededRandom } from "@/lib/text";
import { type NormalizedFeatures, type SentenceFeature, type TextFeatures } from "./features";

export interface SentenceInput {
  index: number;
  paragraphIndex: number;
  features: SentenceFeature;
  documentFeatures: TextFeatures;
  normalized: NormalizedFeatures;
  seed: string;
}

export interface SentenceScore {
  aiProbability: number;
  humanProbability: number;
  confidence: ConfidenceLevel;
  signal: SignalKind;
  signals: DetectedSignal[];
  flagged: boolean;
}

export interface ParagraphInput {
  index: number;
  text: string;
  sentenceScores: SentenceScore[];
  sentenceWordCounts: number[];
  normalized: NormalizedFeatures;
}

export interface ParagraphScore {
  aiProbability: number;
  confidence: ConfidenceLevel;
  signal: SignalKind;
}

export interface DocumentInput {
  text: string;
  features: TextFeatures;
  normalized: NormalizedFeatures;
  sentenceScores: SentenceScore[];
}

export interface DocumentScore {
  aiProbability: number;
  humanProbability: number;
  confidence: ConfidenceLevel;
  classification: Classification;
  breakdown: ClassificationBreakdown;
  signals: DetectedSignal[];
}

export interface DetectionModel {
  readonly id: string;
  readonly version: string;
  analyzeSentence(input: SentenceInput): SentenceScore;
  analyzeParagraph(input: ParagraphInput): ParagraphScore;
  analyzeDocument(input: DocumentInput): DocumentScore;
}

const AI_HIGH = 65;
const AI_LOW = 35;
const FLAG_THRESHOLD = 60;

/**
 * The score lines the engine applies, exported for the same reason the band table
 * is: the explanation cards quote them, and a second copy of a number can drift.
 */
export const DETECTION_SCORE_LINES = {
  /** A sentence at or above this estimated AI likelihood is flagged for review. */
  flag: FLAG_THRESHOLD,
  /** Above this a sentence is painted as an AI signal... */
  aiSignal: AI_HIGH,
  /** ...and below this, as a human one; between the two it reads as mixed. */
  humanSignal: AI_LOW,
} as const;

/**
 * Sentence AI probabilities are bucketed into the four classes by this table,
 * highest band first. The result screen shows these ranges, so they are exported
 * rather than restated: one source of truth for the engine and the UI.
 */
const BREAKDOWN_BANDS: readonly { classification: Classification; min: number }[] = [
  { classification: "ai_generated", min: 72 },
  { classification: "ai_generated_refined", min: 52 },
  { classification: "human_refined", min: 32 },
  { classification: "human_written", min: 0 },
];

export function bandFor(aiProbability: number): Classification {
  for (const band of BREAKDOWN_BANDS) {
    if (aiProbability >= band.min) return band.classification;
  }
  return "human_written";
}

/** Inclusive sentence-score ranges, derived from BREAKDOWN_BANDS so they cannot drift. */
export const CLASSIFICATION_BAND_RANGE: Record<Classification, string> = (() => {
  const ranges = {} as Record<Classification, string>;
  BREAKDOWN_BANDS.forEach((band, index) => {
    const upper = index === 0 ? 100 : BREAKDOWN_BANDS[index - 1].min - 1;
    ranges[band.classification] = `${band.min}\u2013${upper}`;
  });
  return ranges;
})();

function logistic(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * The colour state a score reads as. Exported so anything that has to name the
 * state — the explanation cards among them — uses the engine's own line rather
 * than a second copy of it.
 */
export function signalKind(prob: number, wordCount: number): SignalKind {
  if (wordCount < 4) return "neutral";
  if (prob > AI_HIGH) return "ai";
  if (prob < AI_LOW) return "human";
  return "mixed";
}

function confidenceFor(margin: number, volume: number, spread: number): ConfidenceLevel {
  const evidence = (volume >= 120 ? 2 : volume >= 60 ? 1.5 : volume >= 30 ? 1 : 0.5) +
    (spread <= 12 ? 1 : spread <= 22 ? 0.5 : 0) +
    (margin >= 32 ? 1.5 : margin >= 18 ? 1 : margin >= 8 ? 0.5 : 0);
  if (evidence >= 4) return "very-high";
  if (evidence >= 3) return "high";
  if (evidence >= 1.8) return "moderate";
  return "low";
}

function confidenceFromWordCount(weight: number, wordCount: number): ConfidenceLevel {
  if (wordCount >= 16 && weight >= 0.6) return "high";
  if (wordCount >= 8 && weight >= 0.4) return "moderate";
  return "low";
}

function signal(name: SignalName, weight: number, wordCount: number, explanation: string): DetectedSignal {
  return {
    name,
    weight: Math.round(clamp(weight, 0, 1) * 100) / 100,
    confidence: confidenceFromWordCount(weight, wordCount),
    explanation,
  };
}

const EXPLANATIONS: Record<SignalName, string> = {
  predictable_phrasing:
    "Some phrasing follows familiar patterns that show up often in formal or assisted writing.",
  low_sentence_variation:
    "Sentence lengths here are fairly even, which can make a passage read as steady rather than varied.",
  repetitive_structure:
    "Adjacent sentences begin in a similar way, giving this stretch a consistent rhythm.",
  generic_transition:
    "A widely used connective appears here; such transitions are common across many styles.",
  uniform_sentence_length:
    "Across the passage, sentence lengths cluster closely together.",
  lexical_diversity:
    "The word choice repeats more than it surprises, a trait seen in a range of writing.",
  burstiness:
    "There is little burst-like variation between short and long sentences.",
  syntactic_complexity:
    "The sentence structure trends toward a uniform, formally patterned shape.",
  hedging_density:
    "Qualifying words appear often, softening claims rather than stating them plainly.",
  list_bias:
    "Ideas are laid out in parallel, list-like structures.",
  human_marker:
    "Personal or conversational touches appear here, which are typical of an individual voice.",
};

function buildSignals(sf: SentenceFeature, base: number): DetectedSignal[] {
  const out: DetectedSignal[] = [];
  if (sf.transitionHits > 0) {
    out.push(
      signal("generic_transition", clamp(0.4 + sf.transitionHits * 0.18, 0, 1), sf.wordCount, EXPLANATIONS.generic_transition),
    );
  }
  if (sf.isParallelOpening) {
    out.push(
      signal("repetitive_structure", 0.5, sf.wordCount, EXPLANATIONS.repetitive_structure),
    );
  }
  if (Math.abs(sf.lengthZ) < 0.35 && sf.wordCount >= 6) {
    out.push(
      signal("low_sentence_variation", clamp(0.4 + (0.35 - Math.abs(sf.lengthZ)), 0, 0.8), sf.wordCount, EXPLANATIONS.low_sentence_variation),
    );
  }
  if (sf.hedgeHits > 0) {
    out.push(signal("hedging_density", clamp(0.3 + sf.hedgeHits * 0.15, 0, 0.85), sf.wordCount, EXPLANATIONS.hedging_density));
  }
  const humanHits = sf.firstPersonHits + sf.contractionHits + sf.colloquialHits;
  if (humanHits > 0 && base < 0.6) {
    out.push(signal("human_marker", clamp(0.35 + humanHits * 0.12, 0, 0.9), sf.wordCount, EXPLANATIONS.human_marker));
  }
  if (sf.avgSyllablesPerWord >= 1.65 && sf.wordCount >= 10) {
    out.push(signal("syntactic_complexity", 0.4, sf.wordCount, EXPLANATIONS.syntactic_complexity));
  }
  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, 3);
}

export class HeuristicDetectionModel implements DetectionModel {
  readonly id = "heuristic-veriwrite";
  readonly version = "1.0.0";

  private documentZ(n: NormalizedFeatures): number {
    return (
      -1.5 * n.burstiness +
      -0.7 * n.avgAbsLengthDeviation +
      1.4 * n.transitionRate +
      1.0 * n.parallelOpeningRate +
      0.9 * n.openingRepetitionRate +
      0.8 * n.initialTrigramRepeatRate +
      0.5 * n.repeatedBigramRate +
      0.6 * n.hedgeRate +
      0.35 * n.avgSyllablesPerWord +
      -1.6 * n.firstPersonRate +
      -1.2 * n.colloquialRate +
      -1.3 * n.contractionRate +
      -0.8 * n.punctuationVariety +
      -0.5 * n.lexicalDiversity
    );
  }

  /**
   * The same sum, bounded to ±1.6 and left in the logistic's own units. Unbounded it
   * saturates the curve: every sentence of an evenly machine-styled document then reads
   * 94-96 whatever it says, and the four-class split has nothing to show but one band.
   * Bounded, the document sets a direction a sentence's own evidence can move away from.
   */
  private documentPull(n: NormalizedFeatures): number {
    return Math.tanh(this.documentZ(n) / 3) * 1.6;
  }

  analyzeSentence(input: SentenceInput): SentenceScore {
    const sf = input.features;
    let delta = 0;
    delta += 0.9 * Math.min(sf.transitionHits, 2);
    if (sf.isParallelOpening) delta += 0.7;
    if (Math.abs(sf.lengthZ) < 0.35 && sf.wordCount >= 6) delta += 0.45;
    delta += 0.3 * Math.min(sf.hedgeHits, 2);
    delta -= 0.9 * Math.min(sf.firstPersonHits, 2);
    delta -= 0.8 * Math.min(sf.contractionHits, 2);
    delta -= 0.5 * Math.min(sf.colloquialHits, 2);
    delta -= 0.4 * Math.min(sf.emDashHits, 1);
    // A sentence that leaves the document's average length in either direction is a local
    // choice; the machine pattern this engine knows is an even run of same-sized sentences.
    if (sf.lengthZ >= 1) delta -= 0.55;
    else if (sf.lengthZ <= -1) delta -= 0.4;
    // Weight of the words themselves: a heavy Latinate load in one sentence is the formal
    // pattern, a run of short one-syllable words is not.
    if (sf.wordCount >= 8 && sf.avgSyllablesPerWord >= 1.7) delta += 0.5;
    else if (sf.avgSyllablesPerWord <= 1.3) delta -= 0.45;
    if (sf.wordCount <= 5) delta -= 0.3;

    const z = this.documentPull(input.normalized) + delta * 1.15;
    const rand = seededRandom(`${input.seed}#${input.index}`);
    // The curve is deliberately shallow (0.6 of a logit per unit of evidence): a rule-based
    // engine has no reading of a sentence that deserves 96 or 4, and saturating there made
    // every sentence of an evenly styled document land in one band.
    const base = clamp(logistic(z * 0.6 - 0.2) + (rand() - 0.5) * 0.03, 0.02, 0.98);
    const ai = sf.isFragment ? 50 : Math.round(base * 100);
    const human = 100 - ai;
    const margin = Math.abs(ai - 50);
    return {
      aiProbability: ai,
      humanProbability: human,
      confidence: confidenceFor(margin, sf.wordCount, sf.wordCount < 6 ? 0 : 10),
      signal: signalKind(ai, sf.wordCount),
      signals: sf.isFragment ? [] : buildSignals(sf, base),
      flagged: ai >= FLAG_THRESHOLD,
    };
  }

  analyzeParagraph(input: ParagraphInput): ParagraphScore {
    let weighted = 0;
    let words = 0;
    for (let i = 0; i < input.sentenceScores.length; i += 1) {
      const w = input.sentenceWordCounts[i] || 1;
      weighted += input.sentenceScores[i].aiProbability * w;
      words += w;
    }
    const ai = words > 0 ? Math.round(weighted / words) : 50;
    const spread = spreadOf(input.sentenceScores.map((s) => s.aiProbability));
    return {
      aiProbability: ai,
      confidence: confidenceFor(Math.abs(ai - 50), words, spread),
      signal: signalKind(ai, words),
    };
  }

  analyzeDocument(input: DocumentInput): DocumentScore {
    return scoreDocument(input.sentenceScores, input.features);
  }
}

function spreadOf(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

function aggregateByWords(scores: SentenceScore[], features: TextFeatures): { ai: number; spread: number } {
  const wordCounts = features.sentences.map((s) => s.wordCount);
  let weighted = 0;
  let words = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const w = wordCounts[i] || 1;
    weighted += scores[i].aiProbability * w;
    words += w;
  }
  const ai = words > 0 ? clamp(Math.round(weighted / words), 0, 100) : 50;
  return { ai, spread: spreadOf(scores.map((s) => s.aiProbability)) };
}

function buildBreakdown(scores: SentenceScore[], features: TextFeatures): ClassificationBreakdown {
  const wordCounts = features.sentences.map((s) => s.wordCount);
  const buckets = { ai_generated: 0, ai_generated_refined: 0, human_refined: 0, human_written: 0 };
  let total = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const w = wordCounts[i] || 1;
    buckets[bandFor(scores[i].aiProbability)] += w;
    total += w;
  }
  if (total === 0) return { ai_generated: 0, ai_generated_refined: 0, human_refined: 0, human_written: 100 };

  const raw = {
    ai_generated: (buckets.ai_generated / total) * 100,
    ai_generated_refined: (buckets.ai_generated_refined / total) * 100,
    human_refined: (buckets.human_refined / total) * 100,
    human_written: (buckets.human_written / total) * 100,
  };
  const out = {
    ai_generated: Math.floor(raw.ai_generated),
    ai_generated_refined: Math.floor(raw.ai_generated_refined),
    human_refined: Math.floor(raw.human_refined),
    human_written: Math.floor(raw.human_written),
  };
  // Integer flooring drops fractional points; give the whole remainder to the largest bucket so the four classes sum to exactly 100.
  const used = out.ai_generated + out.ai_generated_refined + out.human_refined + out.human_written;
  let biggest: keyof ClassificationBreakdown = "ai_generated";
  for (const key of Object.keys(out) as (keyof ClassificationBreakdown)[]) {
    if (out[key] > out[biggest]) biggest = key;
  }
  out[biggest] += 100 - used;
  return out;
}

function deriveClassification(
  breakdown: ClassificationBreakdown,
  ai: number,
): Classification {
  const machineShare = breakdown.ai_generated + breakdown.ai_generated_refined;
  // Machine-leaning only when both the class distribution and the word-weighted probability clear their boundaries together.
  if (machineShare >= 50 && ai >= 50) {
    if (ai >= 78 || breakdown.ai_generated >= breakdown.ai_generated_refined) return "ai_generated";
    return "ai_generated_refined";
  }
  // Human side, but AI assistance is reported as visible whenever non-trivial machine signal remains, so the four classes are actually distinguishable.
  if (machineShare >= 12 || ai >= 20) return "human_refined";
  return breakdown.human_written >= breakdown.human_refined ? "human_written" : "human_refined";
}

function documentSignals(scores: SentenceScore[]): DetectedSignal[] {
  const best = new Map<SignalName, DetectedSignal>();
  for (const s of scores) {
    for (const sig of s.signals) {
      const current = best.get(sig.name);
      if (!current || sig.weight > current.weight) best.set(sig.name, sig);
    }
  }
  return [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, 6);
}

function scoreDocument(
  scores: SentenceScore[],
  features: TextFeatures,
): DocumentScore {
  const { ai, spread } = aggregateByWords(scores, features);
  const breakdown = buildBreakdown(scores, features);
  const confidence = confidenceFor(Math.abs(ai - 50), features.wordCount, spread);
  return {
    aiProbability: ai,
    humanProbability: 100 - ai,
    confidence,
    classification: deriveClassification(breakdown, ai),
    breakdown,
    signals: documentSignals(scores),
  };
}

export class EnsembleDetectionModel implements DetectionModel {
  readonly id: string;
  readonly version: string;
  private readonly members: { model: DetectionModel; weight: number }[];

  constructor(members: { model: DetectionModel; weight: number }[]) {
    const total = members.reduce((sum, m) => sum + m.weight, 0) || 1;
    this.members = members.map((m) => ({ model: m.model, weight: m.weight / total }));
    this.id = `ensemble(${this.members.map((m) => m.model.id).join("+")})`;
    this.version = `ens-1(${this.members.map((m) => m.model.version).join(",")})`;
  }

  analyzeSentence(input: SentenceInput): SentenceScore {
    const lead = this.members[0].model.analyzeSentence(input);
    let ai = 0;
    for (const m of this.members) ai += m.model.analyzeSentence(input).aiProbability * m.weight;
    const rounded = Math.round(clamp(ai, 0, 100));
    return {
      aiProbability: rounded,
      humanProbability: 100 - rounded,
      confidence: lead.confidence,
      signal: signalKind(rounded, input.features.wordCount),
      signals: lead.signals,
      flagged: rounded >= FLAG_THRESHOLD,
    };
  }

  analyzeParagraph(input: ParagraphInput): ParagraphScore {
    const lead = this.members[0].model.analyzeParagraph(input);
    let ai = 0;
    for (const m of this.members) ai += m.model.analyzeParagraph(input).aiProbability * m.weight;
    const rounded = Math.round(clamp(ai, 0, 100));
    const words = input.sentenceWordCounts.reduce((a, b) => a + b, 0);
    return { aiProbability: rounded, confidence: lead.confidence, signal: signalKind(rounded, words) };
  }

  analyzeDocument(input: DocumentInput): DocumentScore {
    const lead = this.members[0].model.analyzeDocument(input);
    let ai = 0;
    for (const m of this.members) ai += m.model.analyzeDocument(input).aiProbability * m.weight;
    const rounded = Math.round(clamp(ai, 0, 100));
    const spread = spreadOf(input.sentenceScores.map((s) => s.aiProbability));
    return {
      ...lead,
      aiProbability: rounded,
      humanProbability: 100 - rounded,
      confidence: confidenceFor(Math.abs(rounded - 50), input.features.wordCount, spread),
      classification: deriveClassification(lead.breakdown, rounded),
    };
  }
}

const registry: Record<string, () => DetectionModel> = {
  heuristic: () => new HeuristicDetectionModel(),
};

export const detectionModels: Record<string, () => DetectionModel> = registry;

export function registerModel(key: string, factory: () => DetectionModel): void {
  registry[key] = factory;
}

export function getDefaultModel(): DetectionModel {
  return registry.heuristic();
}

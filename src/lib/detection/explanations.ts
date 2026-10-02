import { DETECTION_SCORE_LINES, signalKind } from "./model";
import { SIGNAL_NAME_LABEL } from "./signals";
import { CONFIDENCE_LABEL, formatNumber } from "@/lib/utils";
import type {
  DetectionResult,
  DetectedSignal,
  SentenceAnalysis,
  SignalKind,
  SignalName,
} from "@/types";

/**
 * What the engine actually looked at for each signal, in one line. Written against
 * the measurements in `features.ts` and `model.ts` so the card's "how this was
 * measured" disclosure states a fact about the code instead of a plausible-sounding
 * restatement of the label.
 */
export const SIGNAL_EVIDENCE: Record<SignalName, string> = {
  generic_transition:
    "A connective from a fixed phrase list appears in the sentence — 'moreover', 'in conclusion', 'it is important to note'.",
  repetitive_structure:
    "The sentence opens with the same first word as the sentence before it.",
  low_sentence_variation:
    "The sentence's length falls inside a narrow band around the average length of the sentences in this text.",
  hedging_density:
    "Qualifying words from a fixed list appear in the sentence — 'perhaps', 'arguably', 'generally'.",
  human_marker:
    "First-person words, contractions or conversational words appear in the sentence.",
  syntactic_complexity:
    "The average number of syllables per word is high and the sentence is long enough for that to carry weight.",
  burstiness:
    "Measured across the text: short and long sentences do not differ much, so the lengths stay close together.",
  lexical_diversity:
    "Measured across the text: the share of distinct words is low against the total word count.",
  predictable_phrasing:
    "The built-in engine does not measure this one. It appears only when an attached engine reports it.",
  uniform_sentence_length:
    "The built-in engine does not measure this one. It appears only when an attached engine reports it.",
  list_bias:
    "The built-in engine does not measure this one. It appears only when an attached engine reports it.",
};

/** Where a card's pattern was measured, which decides how the UI labels it. */
export type ExplanationScope = "sentence" | "document";

export interface ExplanationCard {
  /** Stable within one result: signal name plus the span it describes. */
  key: string;
  name: DetectedSignal["name"];
  /** Short name shown as the card title. */
  title: string;
  /** The engine's own plain-English wording, quoted rather than rewritten here. */
  body: string;
  /** One line naming the measurement behind the card, from `SIGNAL_EVIDENCE`. */
  evidence: string;
  confidence: DetectedSignal["confidence"];
  /** 0-100, the engine's weight for this pattern on this span. */
  strength: number;
  scope: ExplanationScope;
}

export interface ExplanationGroup {
  heading: string;
  /** One or two sentences naming the span, its estimate and how it was scored. */
  lead: string;
  tone: SignalKind;
  cards: ExplanationCard[];
  /** True when the cards describe the surrounding text rather than this sentence. */
  contextOnly: boolean;
  /** The standing "signal, not proof" line every group carries. */
  note: string;
}

function card(
  signal: DetectedSignal,
  scope: ExplanationScope,
  spanKey: string,
): ExplanationCard {
  return {
    key: `${spanKey}:${signal.name}`,
    name: signal.name,
    title: SIGNAL_NAME_LABEL[signal.name],
    body: signal.explanation,
    evidence: SIGNAL_EVIDENCE[signal.name],
    confidence: signal.confidence,
    strength: Math.round(signal.weight * 100),
    scope,
  };
}

/** How many cards to name in the lead, in the words a reader counts. */
function patternPhrase(count: number): string {
  if (count === 0) return "no separate pattern";
  if (count === 1) return "one pattern";
  return `${count} patterns`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The four states inside a sentence, with the article a reader expects.
 * `SIGNAL_KIND_LABEL` is the badge text and has no article, so it cannot be
 * dropped into prose without reading badly.
 */
const KIND_PHRASE: Record<SignalKind, string> = {
  ai: "an AI signal",
  human: "a human signal",
  mixed: "a mixed signal",
  neutral: "no clear signal either way",
};

/**
 * The card set for one sentence, in answer to "why does this one look the way it
 * does?". Sentences carry at most three signals (the engine keeps the strongest),
 * so when none fired the group falls back to the document's own signals and says
 * plainly that they are context, not a finding about this sentence.
 */
export function explainSentence(
  sentence: SentenceAnalysis,
  documentSignals: DetectedSignal[],
  engineLabel: string,
): ExplanationGroup {
  const spanKey = `s${sentence.index}`;
  const cards = sentence.signals.map((signal) => card(signal, "sentence", spanKey));
  const context = cards.length === 0;
  const lines = DETECTION_SCORE_LINES;

  const heading = sentence.flagged
    ? "Why was this section flagged?"
    : "What the engine measured in this sentence";

  const position = sentence.flagged
    ? `at or above the ${lines.flag}% line where the engine starts flagging a sentence`
    : `under the ${lines.flag}% line where the engine starts flagging a sentence`;

  const lead = context
    ? `This sentence reads at ${sentence.aiProbability}% estimated AI likelihood — ${position}. No pattern fired in the sentence on its own, so the cards below are the strongest patterns measured across the whole text, shown as context.`
    : `This sentence reads at ${sentence.aiProbability}% estimated AI likelihood — ${position}. ${capitalize(patternPhrase(cards.length))} ${cards.length === 1 ? "stands out" : "stand out"} here: ${cards.map((c) => c.title.toLowerCase()).join(", ")}.`;

  return {
    heading,
    lead,
    tone: sentence.signal,
    cards: context
      ? documentSignals.slice(0, 3).map((signal) => card(signal, "document", spanKey))
      : cards,
    contextOnly: context,
    note: `Each card is a model signal, not proof that AI wrote this sentence. ${engineLabel} reads this sentence overall as ${KIND_PHRASE[sentence.signal]}. The same patterns show up in writing people do on their own — especially formal or rehearsed prose.`,
  };
}

/**
 * The same cards for the document as one span: the engine's document-level signals
 * are the ones that carry an estimate when a sentence has nothing of its own.
 */
export function explainDocument(result: DetectionResult): ExplanationGroup {
  const engine = `${result.engine} v${result.engineVersion}`;
  const cards = result.signals.map((signal) => card(signal, "document", "doc"));
  const words = formatNumber(result.metrics.words);

  return {
    heading: "What the engine measured across the text",
    lead:
      cards.length === 0
        ? `Across ${words} words the engine found no pattern strong enough to name. The ${result.aiProbability}% document figure rests on the overall shape of the text — sentence lengths, rhythm and word repetition — rather than on any one marker.`
        : `Across ${words} words in ${formatNumber(result.metrics.sentences)} sentences, ${patternPhrase(cards.length)} stood out above the rest: ${cards.map((c) => c.title.toLowerCase()).join(", ")}. The document figure is ${result.aiProbability}% estimated AI likelihood at ${CONFIDENCE_LABEL[result.confidence].toLowerCase()}.`,
    tone: signalKind(result.aiProbability, result.metrics.words),
    cards,
    contextOnly: false,
    note: `These are the strongest patterns ${engine} measured in the text as a whole. They describe how the writing reads to a model, not who produced it.`,
  };
}

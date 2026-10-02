import type { SignalKind, SignalName } from "@/types";

/** The four analysis states the colour system knows, in plain words. */
export const SIGNAL_KIND_LABEL: Record<SignalKind, string> = {
  ai: "AI signal",
  human: "Human signal",
  mixed: "Mixed signal",
  neutral: "Neutral",
};

export const SIGNAL_KIND_NOTE: Record<SignalKind, string> = {
  ai: "This sentence sits at the machine end of the measured range.",
  human: "This sentence carries the personal-voice markers the engine reads toward human authorship.",
  mixed: "The markers on this sentence point both ways.",
  neutral: "Too little text here for the engine to lean either way.",
};

/** Engine signal names in the words the interface uses. */
export const SIGNAL_NAME_LABEL: Record<SignalName, string> = {
  predictable_phrasing: "Predictable phrasing",
  low_sentence_variation: "Low sentence variation",
  repetitive_structure: "Repetitive structure",
  generic_transition: "Generic transition",
  uniform_sentence_length: "Uniform sentence length",
  lexical_diversity: "Repeating vocabulary",
  burstiness: "Even sentence rhythm",
  syntactic_complexity: "Uniform sentence structure",
  hedging_density: "Qualifying words",
  list_bias: "List-like phrasing",
  human_marker: "Personal voice markers",
};

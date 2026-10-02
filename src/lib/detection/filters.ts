import { bandFor } from "./model";
import type { SentenceAnalysis } from "@/types";

/** The sentence filters from the spec's analysis-filter section. */
export const SENTENCE_FILTERS = ["all", "ai", "refined", "human", "flagged"] as const;

export type SentenceFilter = (typeof SENTENCE_FILTERS)[number];

export const SENTENCE_FILTER_LABEL: Record<SentenceFilter, string> = {
  all: "All",
  ai: "AI-generated",
  refined: "AI-refined",
  human: "Human",
  flagged: "Flagged",
};

/**
 * A sentence belongs to a filter by the same band rule the engine used for the
 * document split, so the highlighted set and the breakdown cards can never
 * disagree about which class a sentence fell into.
 */
export function sentenceMatchesFilter(sentence: SentenceAnalysis, filter: SentenceFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "ai":
      return bandFor(sentence.aiProbability) === "ai_generated";
    case "refined": {
      const band = bandFor(sentence.aiProbability);
      return band === "ai_generated_refined" || band === "human_refined";
    }
    case "human":
      return bandFor(sentence.aiProbability) === "human_written";
    case "flagged":
      return sentence.flagged;
  }
}

export function filterCounts(sentences: SentenceAnalysis[]): Record<SentenceFilter, number> {
  const counts = { all: 0, ai: 0, refined: 0, human: 0, flagged: 0 } as Record<SentenceFilter, number>;
  for (const sentence of sentences) {
    for (const filter of SENTENCE_FILTERS) {
      if (sentenceMatchesFilter(sentence, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

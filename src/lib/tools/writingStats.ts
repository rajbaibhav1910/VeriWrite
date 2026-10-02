import {
  countCharacters,
  countWords,
  fleschReadingEase,
  lexicalDiversity,
  mean,
  readabilityLabel,
  splitParagraphs,
  splitSentences,
  stdDev,
} from "@/lib/text";
import type { GrammarIssue, IssueCategory } from "@/types";

/** The measurements the grammar workspace reports beside the findings. */
export interface WritingStatistics {
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
  averageSentenceWords: number;
  /** Spread of sentence lengths; 0 until there are two sentences to compare. */
  sentenceLengthSpread: number;
  readingEase: number;
  readingEaseLabel: string;
  /** Unique words as a share of all words, 0-100. */
  vocabularyVariety: number;
  /** Findings per 100 words, so documents of different lengths can be compared. */
  issuesPer100Words: number;
  byCategory: Record<IssueCategory, number>;
  open: number;
  accepted: number;
  ignored: number;
}

/**
 * Plain measurements of a piece of text plus the state of the findings against
 * it. Every number is counted or derived from the text it was given, so the
 * panel reads as a description of this document rather than a score.
 */
export function describeWriting(text: string, issues: GrammarIssue[]): WritingStatistics {
  const sentences = splitSentences(text);
  const lengths = sentences.map((sentence) => countWords(sentence.text));
  const words = countWords(text);
  const byCategory: Record<IssueCategory, number> = {
    grammar: 0,
    spelling: 0,
    punctuation: 0,
    clarity: 0,
    style: 0,
  };
  let open = 0;
  let accepted = 0;
  let ignored = 0;
  for (const issue of issues) {
    byCategory[issue.category] += 1;
    if (issue.state === "open") open += 1;
    else if (issue.state === "accepted") accepted += 1;
    else ignored += 1;
  }
  const readingEase = fleschReadingEase(text);

  return {
    words,
    characters: countCharacters(text, false),
    sentences: sentences.length,
    paragraphs: splitParagraphs(text).length,
    averageSentenceWords: Math.round(mean(lengths) * 10) / 10,
    sentenceLengthSpread: Math.round(stdDev(lengths) * 10) / 10,
    readingEase,
    readingEaseLabel: readabilityLabel(readingEase),
    vocabularyVariety: Math.round(lexicalDiversity(text) * 100),
    issuesPer100Words: words > 0 ? Math.round((issues.length / words) * 1000) / 10 : 0,
    byCategory,
    open,
    accepted,
    ignored,
  };
}

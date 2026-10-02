import type { LanguageCode } from "@/types";
import {
  countWords,
  fleschReadingEase,
  normalizeText,
  readabilityLabel,
  splitParagraphs,
  splitSentences,
  uniqueWords,
} from "@/lib/text";
import { checkGrammar } from "@/lib/tools/grammarEngine";
import { paraphrase } from "@/lib/tools/paraphraseEngine";
import { humanize } from "@/lib/tools/humanizerEngine";
import { extractKeywords, rankSentences, summarize } from "@/lib/tools/summarizerEngine";
import type { ParaphraseMode } from "@/types";

export type AssistantActionId =
  | "ask"
  | "continue"
  | "rewrite"
  | "explain"
  | "summarize"
  | "outline"
  | "clarity"
  | "tone";

export interface AssistantActionMeta {
  id: AssistantActionId;
  label: string;
  description: string;
  /** False means the bundled build states that it cannot do this without a model. */
  local: boolean;
}

export const ASSISTANT_ACTIONS: AssistantActionMeta[] = [
  { id: "summarize", label: "Summarize", description: "Condense the document or the selection.", local: true },
  { id: "outline", label: "Generate outline", description: "Turn the prose into a heading tree.", local: true },
  { id: "explain", label: "Explain", description: "Report what the passage says and how it is built.", local: true },
  { id: "rewrite", label: "Rewrite", description: "Rephrase the selection in another register.", local: true },
  { id: "clarity", label: "Improve clarity", description: "Cut wordiness and fix mechanical issues.", local: true },
  { id: "tone", label: "Change tone", description: "Shift the selection toward a chosen register.", local: true },
  { id: "continue", label: "Continue writing", description: "Draft what comes next.", local: false },
  { id: "ask", label: "Ask AI", description: "Answer a question about the topic.", local: false },
];

export interface AssistantRequest {
  action: AssistantActionId;
  documentText: string;
  selection?: string;
  language?: LanguageCode;
  /** Used by `tone`; maps a tone label onto a rewrite mode. */
  tone?: string;
  /** Free-text prompt for `ask`. */
  prompt?: string;
}

export interface AssistantReply {
  action: AssistantActionId;
  text: string;
  /** Set when the action needs a language model this build does not ship. */
  requiresModel: boolean;
  /** What the reply was derived from, so the panel can label its own basis. */
  basis: string;
  /**
   * The part of the reply that is document prose, so "Insert" never pastes a heading
   * or a bullet list of commentary into the text. Null when nothing is insertable.
   */
  insertText: string | null;
}

const MODEL_REQUIRED =
  "This build ships no language model, so it will not invent sentences for you. The writing actions that work from your own text — summarize, outline, explain, rewrite, clarity and tone — are available above.";

const TONE_MODE: Record<string, ParaphraseMode> = {
  casual: "simple",
  confident: "professional",
  warm: "fluency",
  formal: "formal",
  direct: "professional",
  academic: "academic",
  creative: "creative",
  neutral: "standard",
};

/** The registers "Change tone" offers; the panel lists these rather than inventing its own. */
export const ASSISTANT_TONES: { id: string; label: string }[] = Object.keys(TONE_MODE).map((id) => ({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
}));

function target(request: AssistantRequest): string {
  const raw = request.selection?.trim() ? request.selection : request.documentText;
  return normalizeText(raw);
}

function outlineOf(text: string): string {
  const paragraphs = splitParagraphs(text);
  const lines: string[] = [];
  paragraphs.forEach((paragraph, index) => {
    const sentences = splitSentences(paragraph.text);
    if (sentences.length === 0) return;
    const heading =
      sentences[0].text.length <= 70
        ? sentences[0].text.replace(/[.!?]+$/u, "")
        : `${sentences[0].text.slice(0, 67).trimEnd()}…`;
    lines.push(`${index + 1}. ${heading}`);
    for (const sentence of sentences.slice(1)) {
      const trimmed = sentence.text.trim();
      if (!trimmed) continue;
      const point = trimmed.length <= 110 ? trimmed : `${trimmed.slice(0, 107).trimEnd()}…`;
      lines.push(`   — ${point}`);
    }
  });
  return lines.join("\n");
}

function descriptionOf(text: string): string {
  const sentences = splitSentences(text);
  const words = countWords(text);
  const ranked = rankSentences(text).slice(0, 3);
  const keywords = extractKeywords(text, 6);
  const connectors = (text.match(
    /\b(however|moreover|therefore|because|although|whereas|in addition|for example)\b/giu,
  ) ?? []).length;
  return [
    `The passage is ${words} words across ${sentences.length} sentences in ${splitParagraphs(text).length} paragraphs.`,
    ranked.length > 0
      ? `Its main lines are: ${ranked.map((entry) => `“${entry.text.slice(0, 90)}${entry.text.length > 90 ? "…" : ""}”`).join("; ")}.`
      : "No sentence stands out as the thesis.",
    keywords.length > 0 ? `Recurring terms: ${keywords.join(", ")}.` : "",
    `Readability measures ${Math.round(fleschReadingEase(text))} (${readabilityLabel(fleschReadingEase(text))}); ${
      words > 0 ? Math.round((uniqueWords(text) / words) * 100) : 0
    }% of word tokens are unique; ${connectors} explicit connective${connectors === 1 ? "" : "s"} tie the argument together.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function assistantActionNeedsModel(action: AssistantActionId): boolean {
  return action === "ask" || action === "continue";
}

/**
 * The bundled assistant only ever re-describes or rewrites text that is already on
 * the page. Actions that would require generating new content report that plainly
 * instead of filling the panel with invented prose.
 */
export function runAssistantAction(request: AssistantRequest): AssistantReply {
  const text = target(request);

  if (text.length === 0 && request.action !== "ask" && request.action !== "continue") {
    return {
      action: request.action,
      text: "There is nothing to work on yet. Write or paste something, or select a passage.",
      requiresModel: false,
      basis: "empty document",
      insertText: null,
    };
  }

  switch (request.action) {
    case "ask":
    case "continue": {
      return {
        action: request.action,
        text: MODEL_REQUIRED,
        requiresModel: true,
        basis: "no model attached",
        insertText: null,
      };
    }
    case "summarize": {
      const result = summarize(text, {
        length: Math.max(2, Math.min(6, Math.round(splitSentences(text).length * 0.25))),
        format: "bullets",
      });
      return {
        action: "summarize",
        text: [result.summary, ...result.keyPoints.map((point) => `• ${point}`)].filter(Boolean).join("\n"),
        requiresModel: false,
        basis: `ranked sentences, ${Math.round(result.compressionRatio * 100)}% compression`,
        insertText: result.summary || null,
      };
    }
    case "outline": {
      const outline = outlineOf(text);
      return {
        action: "outline",
        text: outline,
        requiresModel: false,
        basis: "paragraph and sentence structure",
        insertText: outline || null,
      };
    }
    case "explain": {
      return {
        action: "explain",
        text: descriptionOf(text),
        requiresModel: false,
        basis: "measured text statistics",
        // Commentary about the passage, never prose to drop into it.
        insertText: null,
      };
    }
    case "clarity": {
      const issues = checkGrammar(text);
      const softened = humanize(text, {
        strength: 0.4,
        tone: "neutral",
        formality: 0.35,
        creativity: 0.3,
      });
      const lines = issues
        .slice(0, 6)
        .map((issue) => `• ${issue.original} → ${issue.suggestion}: ${issue.explanation}`);
      return {
        action: "clarity",
        text: [
          issues.length === 0
            ? "No mechanical issues found in this passage."
            : `${issues.length} mechanical ${issues.length === 1 ? "issue" : "issues"}:`,
          ...lines,
          "",
          "Cleaned version:",
          softened.after,
        ].join("\n"),
        requiresModel: false,
        basis: `${issues.length} rule hits, sentence-rhythm pass`,
        insertText: softened.after || null,
      };
    }
    case "tone":
    case "rewrite": {
      const mode = request.action === "tone" ? (TONE_MODE[request.tone ?? ""] ?? "standard") : "fluency";
      const result = paraphrase(text, {
        mode,
        tone: request.tone ?? "neutral",
        synonymLevel: 0.6,
        language: request.language ?? "en",
      });
      return {
        action: request.action,
        text: result.output,
        requiresModel: false,
        basis: `${result.changedWords} of ${countWords(text)} words changed, ${Math.round(result.similarity * 100)}% held`,
        insertText: result.output || null,
      };
    }
  }
}

/** Splits a reply into word groups so the panel can reveal it progressively. */
export function chunkAssistantText(text: string, groupSize = 6): string[] {
  const paragraphs = text.split(/\n{1}/u);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/u).filter(Boolean);
    if (words.length === 0) {
      chunks.push("\n");
      continue;
    }
    for (let index = 0; index < words.length; index += groupSize) {
      chunks.push(words.slice(index, index + groupSize).join(" "));
    }
    chunks.push("\n");
  }
  return chunks;
}

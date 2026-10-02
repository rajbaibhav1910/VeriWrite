import { seededRandom, splitParagraphs, splitSentences, fleschReadingEase, tokenize, mean, stdDev } from "@/lib/text";
import { clamp } from "@/lib/utils";

/**
 * Local style engine for rhythm and readability. It is a prose-cleanup tool:
 * it varies sentence length, trims stock transitions and adds subordination.
 * It does not claim, and must not be described as, a way to defeat detectors.
 */

export type HumanizerChangeKind =
  | "split"
  | "join"
  | "contraction"
  | "transition"
  | "concision"
  | "subordinate"
  | "opening";

export interface HumanizerChange {
  /** Index of the affected sentence in the source text, counting from 0. */
  sentenceIndex: number;
  kind: HumanizerChangeKind;
  original: string;
  revised: string;
  note: string;
}

export interface HumanizerOptions {
  /** 0-1, how aggressive the rewrite is. */
  strength: number;
  tone: string;
  /** 0-1, 1 = formal register. Contractions are only used below 0.6. */
  formality: number;
  /** 0-1, how much variety the engine is allowed to introduce. */
  creativity: number;
}

export interface HumanizerResult {
  before: string;
  /** Text after the per-sentence pass and before the rhythm merges. */
  draft: string;
  after: string;
  changes: HumanizerChange[];
  readabilityBefore: number;
  readabilityAfter: number;
  readabilityDelta: number;
  /** Standard deviation of sentence lengths, before and after. */
  rhythmBefore: number;
  rhythmAfter: number;
  options: HumanizerOptions;
}

/**
 * Which set of connectives a tone label actually selects. Only three buckets
 * exist, so the UI can name the effect of a tone instead of implying six.
 */
export function toneBucket(tone: string) {
  const value = (tone ?? "").toLowerCase();
  if (value.includes("formal") || value.includes("academic")) return "formal" as const;
  if (value.includes("casual") || value.includes("friendly") || value.includes("conversational")) {
    return "casual" as const;
  }
  return "neutral" as const;
}

/** Contractions are a register choice, so formality has the final word. */
export function allowsContractions(formality: number, tone: string) {
  return formality < 0.6 || toneBucket(tone) === "casual";
}

/** Filler and stock academic transitions, with the shorter form we replace them with. */
const CONCISION: { from: string; to: string; note: string }[] = [
  { from: "in order to", to: "to", note: "cut a wordy infinitive" },
  { from: "due to the fact that", to: "because", note: "plain causal conjunction" },
  { from: "in the event that", to: "if", note: "plain conditional" },
  { from: "at this point in time", to: "now", note: "removed a filler phrase" },
  { from: "in today's fast-paced world", to: "today", note: "dropped a stock opener" },
  { from: "it is worth noting that", to: "", note: "dropped an announcing phrase" },
  { from: "it is important to note that", to: "", note: "dropped an announcing phrase" },
  { from: "needless to say", to: "", note: "dropped a filler opener" },
  { from: "when it comes to", to: "for", note: "shorter framing" },
  { from: "in terms of", to: "for", note: "shorter framing" },
  { from: "a large number of", to: "many", note: "concrete quantity" },
  { from: "utilize", to: "use", note: "plainer verb" },
  { from: "utilizes", to: "uses", note: "plainer verb" },
  { from: "utilization", to: "use", note: "plainer noun" },
  { from: "leverage", to: "use", note: "plainer verb" },
  { from: "facilitate", to: "help", note: "plainer verb" },
  { from: "commence", to: "start", note: "plainer verb" },
  { from: "subsequently", to: "later", note: "plainer adverb" },
  { from: "prior to", to: "before", note: "plainer preposition" },
  { from: "endeavor to", to: "try to", note: "plainer verb" },
  { from: "methodology", to: "method", note: "shorter noun" },
  { from: "paradigm", to: "model", note: "shorter noun" },
  { from: "holistic", to: "complete", note: "concrete adjective" },
  { from: "robust", to: "solid", note: "concrete adjective" },
  { from: "seamless", to: "smooth", note: "concrete adjective" },
  { from: "cutting-edge", to: "latest", note: "concrete adjective" },
  { from: "delve into", to: "look at", note: "plainer verb" },
  { from: "delves into", to: "looks at", note: "plainer verb" },
  { from: "a testament to", to: "shows", note: "dropped an inflated phrase" },
  { from: "plays a crucial role in", to: "shapes", note: "direct verb" },
  { from: "in the realm of", to: "in", note: "shorter framing" },
  { from: "navigating the complexities of", to: "handling", note: "shorter gerund" },
  { from: "ever-evolving", to: "changing", note: "concrete adjective" },
  { from: "unlock the potential of", to: "get more from", note: "concrete verb" },
  { from: "game-changer", to: "big change", note: "dropped a buzzword" },
  { from: "synergy", to: "teamwork", note: "concrete noun" },
  { from: "very unique", to: "unusual", note: "removed a contradiction" },
  { from: "each and every", to: "every", note: "removed a doublet" },
];

/** Connectors that read as templated; the replacement depends on the requested tone. */
const TRANSITIONS: { from: string; neutral: string; casual: string; formal: string }[] = [
  { from: "Moreover,", neutral: "Also,", casual: "Plus,", formal: "In addition," },
  { from: "Furthermore,", neutral: "Also,", casual: "And,", formal: "Moreover," },
  { from: "Additionally,", neutral: "Also,", casual: "On top of that,", formal: "In addition," },
  { from: "However,", neutral: "But", casual: "Still,", formal: "Even so," },
  { from: "Nevertheless,", neutral: "Still,", casual: "Even so,", formal: "Even so," },
  { from: "In conclusion,", neutral: "So,", casual: "Bottom line:", formal: "Overall," },
  { from: "Consequently,", neutral: "So,", casual: "That is why", formal: "As a result," },
  { from: "Therefore,", neutral: "So,", casual: "So", formal: "As a result," },
  { from: "It should be noted that", neutral: "Note that", casual: "Worth knowing:", formal: "Note that" },
];

const CONTRACTIONS: [RegExp, string][] = [
  [/\bdo not\b/g, "don't"],
  [/\bcannot\b/g, "can't"],
  [/\bare not\b/g, "aren't"],
  [/\bis not\b/g, "isn't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bshould not\b/g, "shouldn't"],
  [/\bcould not\b/g, "couldn't"],
  [/\bwill not\b/g, "won't"],
  [/\bit is\b/g, "it's"],
  [/\bthat is\b/g, "that's"],
  [/\bthere is\b/g, "there's"],
  [/\bwe are\b/g, "we're"],
  [/\bwe have\b/g, "we've"],
  [/\byou are\b/g, "you're"],
  [/\bI am\b/g, "I'm"],
  [/\bhas not\b/g, "hasn't"],
  [/\bhave not\b/g, "haven't"],
  [/\bthey are\b/g, "they're"],
];

const SUBORDINATES = ["because", "since", "although", "while", "so that", "even though"];

function tidy(value: string) {
  return value.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/^\s*([,.;:!?])/g, "$1").trim();
}

function capitalizeFirst(value: string) {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function lowerFirst(value: string) {
  return value.length === 0 ? value : value.charAt(0).toLowerCase() + value.slice(1);
}

function wordCount(value: string) {
  return tokenize(value).length;
}

/** Split points that leave two grammatical sentences behind. */
function splitLong(body: string): { parts: string[]; note: string } | null {
  const patterns: { re: RegExp; second: (rest: string) => string; note: string }[] = [
    { re: /^(?<a>[^,.!?;:]{20,}), which (?<b>.{8,})$/u, second: (rest) => `This ${lowerFirst(rest)}`, note: "split a relative clause into its own sentence" },
    { re: /^(?<a>[^,.!?;:]{20,}), and it (?<b>.{8,})$/u, second: (rest) => `It ${lowerFirst(rest)}`, note: "gave the second clause its own sentence" },
    { re: /^(?<a>[^,.!?;:]{20,}); (?<b>.{8,})$/u, second: (rest) => capitalizeFirst(rest), note: "turned a semicolon join into two beats" },
    { re: /^(?<a>[^,.!?;:]{24,}) because (?<b>.{10,})$/u, second: (rest) => `That is because ${lowerFirst(rest)}`, note: "moved the reason into a separate sentence" },
    { re: /^(?<a>[^,.!?;:]{24,}), but (?<b>.{10,})$/u, second: (rest) => `But ${lowerFirst(rest)}`, note: "let the contrast start its own sentence" },
  ];
  for (const entry of patterns) {
    const match = body.match(entry.re);
    if (!match?.groups) continue;
    const first = tidy(match.groups.a ?? "");
    const second = entry.second(tidy(match.groups.b ?? ""));
    if (wordCount(first) < 6 || wordCount(second) < 5) continue;
    return { parts: [first, second], note: entry.note };
  }
  return null;
}

/** Joins two clipped sentences with a subordinate connective. */
function joinShort(first: string, second: string, pick: () => number): { text: string; note: string } | null {
  const marker = SUBORDINATES[Math.floor(pick() * SUBORDINATES.length)] ?? "because";
  if (marker === "although" || marker === "while" || marker === "even though") {
    return { text: `${first}, ${marker} ${lowerFirst(second)}`, note: `joined two clipped sentences with “${marker}”` };
  }
  if (marker === "so that") {
    return { text: `${first} so that ${lowerFirst(second)}`, note: "linked a purpose clause to the previous sentence" };
  }
  return { text: `${first}, ${marker} ${lowerFirst(second)}`, note: `joined two clipped sentences with “${marker}”` };
}

interface SentenceDraft {
  text: string;
  index: number;
}

/** How uneven the sentence lengths are — the rhythm the second pass works on. */
function rhythmOf(value: string) {
  return stdDev(splitSentences(value).map((sentence) => wordCount(sentence.text)));
}

export function humanize(text: string, options: HumanizerOptions): HumanizerResult {
  const strength = clamp(Number.isFinite(options.strength) ? options.strength : 0.5, 0, 1);
  const formality = clamp(Number.isFinite(options.formality) ? options.formality : 0.5, 0, 1);
  const creativity = clamp(Number.isFinite(options.creativity) ? options.creativity : 0.5, 0, 1);
  const tone = (options.tone ?? "").toLowerCase();
  const useContractions = allowsContractions(formality, tone);
  const bucket = toneBucket(tone);

  const resolved: HumanizerOptions = { strength, tone: options.tone, formality, creativity };

  // Strength 0 has to mean something the page can promise: your text, untouched.
  if (strength <= 0) {
    return {
      before: text,
      draft: text,
      after: text,
      changes: [],
      readabilityBefore: fleschReadingEase(text),
      readabilityAfter: fleschReadingEase(text),
      readabilityDelta: 0,
      rhythmBefore: Math.round(rhythmOf(text) * 100) / 100,
      rhythmAfter: Math.round(rhythmOf(text) * 100) / 100,
      options: resolved,
    };
  }

  const draw = seededRandom(`${text}|${strength}|${formality}|${creativity}|${tone}`);
  const changes: HumanizerChange[] = [];

  const paragraphs = splitParagraphs(text);
  const drafts: SentenceDraft[] = [];
  // Every reported change has to quote the document the user actually has, so the
  // source sentence behind each rewrite step is kept by index.
  const sourceByIndex = new Map<number, string>();
  let globalIndex = 0;

  const newParagraphs = paragraphs.map((paragraph) => {
    const spans = splitSentences(paragraph.text);
    const replacements: { start: number; end: number; value: string }[] = [];
    const slotSources: { index: number; sentences: number }[] = [];

    for (let i = 0; i < spans.length; i += 1) {
      const span = spans[i];
      const term = span.text.match(/[.!?]+["'”’)\]]*$/u)?.[0] ?? ".";
      let body = term === "" ? span.text : span.text.replace(/[.!?]+["'”’)\]]*$/u, "");
      const original = span.text;
      const applied: string[] = [];
      let changed = false;

      for (const entry of CONCISION) {
        const re = new RegExp(`\\b${entry.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        if (!re.test(body)) continue;
        if (draw() > strength * 0.9 + 0.1) continue;
        body = body.replace(re, (found) => (/[A-Z]/.test(found[0] ?? "") ? capitalizeFirst(entry.to) : entry.to));
        applied.push(entry.note);
        changed = true;
      }

      for (const entry of TRANSITIONS) {
        if (!body.toLowerCase().startsWith(entry.from.toLowerCase())) continue;
        if (draw() > strength * 0.85 + 0.1) continue;
        const replacement = bucket === "casual" ? entry.casual : bucket === "formal" ? entry.formal : entry.neutral;
        body = replacement + body.slice(entry.from.length);
        applied.push(`swapped a templated transition for “${replacement.replace(/,$/, "")}”`);
        changed = true;
      }

      if (changed && /^[a-z]/u.test(body.trim())) body = capitalizeFirst(body.trim());

      const length = wordCount(body);
      if (length > 22 && strength > 0.25 && draw() < 0.4 + strength * 0.6) {
        const split = splitLong(body);
        if (split) {
          body = split.parts.join(". ");
          applied.push(split.note);
          changed = true;
        }
      }

      if (useContractions && strength > 0.2) {
        for (const [re, replacement] of CONTRACTIONS) {
          if (!re.test(body)) continue;
          re.lastIndex = 0;
          if (draw() > strength) continue;
          body = body.replace(re, replacement);
          applied.push(`used the contraction “${replacement}”`);
          changed = true;
        }
      }

      if (creativity > 0.4 && i > 0) {
        const previous = drafts[globalIndex - 1]?.text ?? "";
        const firstWord = body.split(/\s+/u)[0]?.toLowerCase() ?? "";
        const prevFirst = previous.split(/\s+/u)[0]?.toLowerCase() ?? "";
        const prevSecond = previous.split(/\s+/u)[1]?.toLowerCase() ?? "";
        const secondWord = body.split(/\s+/u)[1]?.toLowerCase() ?? "";
        const sameOpening = firstWord.length > 0 && firstWord === prevFirst && secondWord === prevSecond;
        if (sameOpening && draw() < creativity * 0.8) {
          const asides = ["In practice, ", "On paper, ", "In day-to-day work, ", "By and large, "];
          const aside = asides[Math.floor(draw() * asides.length)] ?? "In practice, ";
          body = aside + lowerFirst(body);
          applied.push("varied a repeated sentence opening");
          changed = true;
        }
      }

      body = tidy(body);
      const rebuilt = `${body}${term === "" ? "" : term}`;
      drafts.push({ text: rebuilt, index: globalIndex });
      sourceByIndex.set(globalIndex, original);
      // A split leaves two sentences in one slot, which the rhythm pass has to know
      // to keep its own sentences lined up with the right source sentence.
      slotSources.push({ index: globalIndex, sentences: Math.max(1, splitSentences(rebuilt).length) });
      if (changed) {
        changes.push({
          sentenceIndex: globalIndex,
          kind: applied.some((n) => n.includes("split")) ? "split"
            : applied.some((n) => n.includes("contraction")) ? "contraction"
              : applied.some((n) => n.includes("transition")) ? "transition"
                : applied.some((n) => n.includes("opening")) ? "opening"
                  : "concision",
          original,
          revised: rebuilt,
          note: applied.join("; "),
        });
      }
      globalIndex += 1;
      replacements.push({ start: span.start, end: span.end, value: rebuilt });
    }

    let out = paragraph.text;
    for (let i = replacements.length - 1; i >= 0; i -= 1) {
      const item = replacements[i];
      out = out.slice(0, item.start) + item.value + out.slice(item.end);
    }
    return { start: paragraph.start, end: paragraph.end, value: out, slots: slotSources };
  });

  // Which source sentence a draft sentence grew out of. A split slot feeds two
  // sentences, so the mapping walks the counts instead of trusting positions.
  const slotOf = (paragraphIndex: number, position: number) => {
    const slots = newParagraphs[paragraphIndex]?.slots ?? [];
    let seen = 0;
    for (const slot of slots) {
      if (position < seen + slot.sentences) return slot.index;
      seen += slot.sentences;
    }
    return slots.length > 0 ? slots[slots.length - 1].index : 0;
  };
  const quoteSource = (paragraphIndex: number, from: number, to: number) =>
    [...new Set([slotOf(paragraphIndex, from), slotOf(paragraphIndex, to)])]
      .map((index) => sourceByIndex.get(index) ?? "")
      .filter(Boolean)
      .join(" ");

  // Second pass: stitch clipped neighbours together so the rhythm varies.
  let draft = text;
  for (let i = newParagraphs.length - 1; i >= 0; i -= 1) {
    const item = newParagraphs[i];
    draft = draft.slice(0, item.start) + item.value + draft.slice(item.end);
  }
  const after0 = draft;

  const paragraphSpans = splitParagraphs(after0);
  const joins: { start: number; end: number; value: string }[] = [];
  const sentenceLists = paragraphSpans.map((paragraph) => splitSentences(paragraph.text));
  for (let p = 0; p < paragraphSpans.length; p += 1) {
    const spans = sentenceLists[p];
    let cursor = 0;
    while (cursor < spans.length - 1) {
      const first = spans[cursor];
      const second = spans[cursor + 1];
      const shortPair = wordCount(first.text) <= 8 && wordCount(second.text) <= 10 && strength > 0.3;
      const uniform = wordCount(first.text) <= 12 && wordCount(second.text) <= 12;
      if (shortPair && uniform && draw() < 0.35 + strength * 0.5) {
        const join = joinShort(first.text.replace(/[.!?]$/u, ""), second.text.replace(/[.!?]$/u, ""), draw);
        if (join) {
          joins.push({ start: paragraphSpans[p].start + first.start, end: paragraphSpans[p].start + second.end, value: `${join.text}.` });
          changes.push({
            sentenceIndex: slotOf(p, cursor),
            kind: "subordinate",
            original: quoteSource(p, cursor, cursor + 1),
            revised: `${join.text}.`,
            note: join.note,
          });
          cursor += 2;
          continue;
        }
      }
      cursor += 1;
    }
  }
  let after = after0;
  for (let i = joins.length - 1; i >= 0; i -= 1) {
    const item = joins[i];
    after = after.slice(0, item.start) + item.value + after.slice(item.end);
  }

  const readabilityBefore = fleschReadingEase(text);
  const readabilityAfter = fleschReadingEase(after);

  return {
    before: text,
    draft: after0,
    after,
    changes: changes.sort((a, b) => a.sentenceIndex - b.sentenceIndex),
    readabilityBefore,
    readabilityAfter,
    readabilityDelta: readabilityAfter - readabilityBefore,
    rhythmBefore: Math.round(rhythmOf(text) * 100) / 100,
    rhythmAfter: Math.round(rhythmOf(after) * 100) / 100,
    options: resolved,
  };
}

export const HUMANIZER_TONES = ["neutral", "casual", "confident", "warm", "formal", "direct"] as const;

/** A plain-language summary of what the run did, for the result header. */
export function describeHumanizerRun(result: HumanizerResult) {
  const counts = result.changes.reduce<Record<string, number>>((acc, change) => {
    acc[change.kind] = (acc[change.kind] ?? 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(counts).map(([kind, count]) => `${count} ${kind}`);
  const spread = Math.round(mean(result.after ? splitSentences(result.after).map((s) => wordCount(s.text)) : []));
  return `${parts.length ? parts.join(", ") : "no changes"} · sentence length ~${spread} words · reading ease ${result.readabilityBefore} → ${result.readabilityAfter}`;
}

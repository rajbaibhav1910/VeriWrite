import type { AnalysisPhase } from "@/types";
import { apiRequest, backendConfigured } from "@/lib/api";
import {
  PHASE_PAUSE_MS,
  assertTextLength,
  requireRecord,
  requireString,
  sleep,
  throwIfAborted,
} from "@/lib/service";
import {
  HUMANIZER_TONES,
  allowsContractions,
  describeHumanizerRun,
  toneBucket,
  humanize as runHumanizerEngine,
} from "@/lib/tools/humanizerEngine";
import type { HumanizerChange, HumanizerOptions, HumanizerResult } from "@/lib/tools/humanizerEngine";

export { HUMANIZER_TONES, allowsContractions, describeHumanizerRun, toneBucket };
export type { HumanizerChange, HumanizerOptions, HumanizerResult };

/** Five sentences' worth of rhythm is the shortest passage the style pass can work on. */
export const HUMANIZER_MIN_WORDS = 5;

/**
 * Positioning the UI must keep: this is a style tool. The spec forbids selling it
 * as a way to defeat detectors, so the claim lives with the service, not a component.
 */
export const HUMANIZER_NOTE =
  "The humanizer rewrites for rhythm, plain wording and register. It is a readability tool, not a way to evade detection: it does not change what a detector scores, and no rewrite should be presented as proof of authorship.";

export interface HumanizerRunOptions extends HumanizerOptions {
  signal?: AbortSignal;
  onPhase?: (phase: AnalysisPhase) => void;
}

function guardChange(value: unknown): HumanizerChange {
  const record = requireRecord(value, "humanizer");
  return {
    sentenceIndex:
      typeof record.sentenceIndex === "number" ? record.sentenceIndex : 0,
    kind: (typeof record.kind === "string" ? record.kind : "concision") as HumanizerChange["kind"],
    original: typeof record.original === "string" ? record.original : "",
    revised: typeof record.revised === "string" ? record.revised : "",
    note: typeof record.note === "string" ? record.note : "",
  };
}

function guardHumanizer(text: string, payload: unknown): HumanizerResult {
  const record = requireRecord(payload, "humanizer");
  const after = requireString(record, "after", "humanizer");
  const readabilityBefore =
    typeof record.readabilityBefore === "number" ? record.readabilityBefore : 0;
  const readabilityAfter =
    typeof record.readabilityAfter === "number" ? record.readabilityAfter : 0;
  return {
    before: text,
    draft: typeof record.draft === "string" ? record.draft : after,
    after,
    changes: Array.isArray(record.changes) ? record.changes.map(guardChange) : [],
    readabilityBefore,
    readabilityAfter,
    readabilityDelta: readabilityAfter - readabilityBefore,
    rhythmBefore: typeof record.rhythmBefore === "number" ? record.rhythmBefore : 0,
    rhythmAfter: typeof record.rhythmAfter === "number" ? record.rhythmAfter : 0,
    options: {
      strength: typeof record.strength === "number" ? record.strength : 0.5,
      tone: typeof record.tone === "string" ? record.tone : "neutral",
      formality: typeof record.formality === "number" ? record.formality : 0.5,
      creativity: typeof record.creativity === "number" ? record.creativity : 0.5,
    },
  };
}

async function humanizeRemotely(
  text: string,
  options: HumanizerRunOptions,
): Promise<HumanizerResult> {
  const payload = await apiRequest<unknown>("/api/humanize", {
    method: "POST",
    body: {
      text,
      strength: options.strength,
      tone: options.tone,
      formality: options.formality,
      creativity: options.creativity,
    },
    signal: options.signal,
  });
  return guardHumanizer(text, payload);
}

async function humanizeLocally(
  text: string,
  options: HumanizerRunOptions,
): Promise<HumanizerResult> {
  const { signal, onPhase } = options;
  throwIfAborted(signal, "That rewrite");
  onPhase?.("preparing");
  assertTextLength(text, "The humanizer", HUMANIZER_MIN_WORDS);
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That rewrite");
  onPhase?.("analyzing");
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That rewrite");
  onPhase?.("scoring");
  const result = runHumanizerEngine(text, options);

  onPhase?.("reporting");
  await sleep(PHASE_PAUSE_MS / 2);
  return result;
}

export async function humanizeText(
  text: string,
  options: HumanizerRunOptions,
): Promise<HumanizerResult> {
  return backendConfigured() ? humanizeRemotely(text, options) : humanizeLocally(text, options);
}

export const DEFAULT_HUMANIZER_OPTIONS: HumanizerOptions = {
  strength: 0.55,
  tone: "neutral",
  formality: 0.4,
  creativity: 0.5,
};

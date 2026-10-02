import type {
  AnalysisPhase,
  LanguageCode,
  ParaphraseMode,
  ParaphraseOptions,
  ParaphraseResult,
} from "@/types";
import { ApiError, apiRequest, backendConfigured } from "@/lib/api";
import { LANGUAGE_NAMES } from "@/config/languages";
import {
  PHASE_PAUSE_MS,
  assertTextLength,
  requireRecord,
  requireString,
  sleep,
  throwIfAborted,
} from "@/lib/service";
import {
  PARAPHRASE_MODES,
  countChangedTokens,
  paraphrase as runParaphraseEngine,
} from "@/lib/tools/paraphraseEngine";
import { SUPPORTED_LANGUAGES } from "@/services/detectorService";

export { PARAPHRASE_MODES };

/**
 * The rewriter works on sentences, so three words is as short a passage as it can
 * turn into something worth reading back. The page reads this instead of guessing.
 */
export const PARAPHRASE_MIN_WORDS = 3;

export const PARAPHRASE_TONES = [
  "neutral",
  "casual",
  "confident",
  "warm",
  "formal",
  "direct",
] as const;

export interface ParaphraseRunOptions extends ParaphraseOptions {
  signal?: AbortSignal;
  onPhase?: (phase: AnalysisPhase) => void;
}

export interface ParaphraseCapabilities {
  engine: "backend" | "local";
  modes: ParaphraseMode[];
  /** The bundled rewriter does not vary output by tone label; the UI says so. */
  toneControl: boolean;
  synonymLevelControl: boolean;
  /** The languages the attached rewriter really works on. */
  languages: LanguageCode[];
}

function isMode(value: unknown): value is ParaphraseMode {
  return (
    typeof value === "string" && PARAPHRASE_MODES.some((mode) => mode.id === value)
  );
}

function guardParaphrase(text: string, payload: unknown): ParaphraseResult {
  const record = requireRecord(payload, "paraphrase");
  const output = requireString(record, "output", "paraphrase");
  const mode = isMode(record.mode) ? record.mode : "standard";
  return {
    output,
    changedWords:
      typeof record.changedWords === "number"
        ? record.changedWords
        : countChangedTokens(text, output),
    similarity: typeof record.similarity === "number" ? record.similarity : 1,
    mode,
  };
}

async function paraphraseRemotely(
  text: string,
  options: ParaphraseRunOptions,
): Promise<ParaphraseResult> {
  const payload = await apiRequest<unknown>("/api/paraphrase", {
    method: "POST",
    body: {
      text,
      mode: options.mode,
      tone: options.tone,
      synonymLevel: options.synonymLevel,
      language: options.language,
      variant: options.variant ?? 0,
    },
    signal: options.signal,
  });
  return guardParaphrase(text, payload);
}

async function paraphraseLocally(
  text: string,
  options: ParaphraseRunOptions,
): Promise<ParaphraseResult> {
  const { signal, onPhase } = options;
  throwIfAborted(signal, "That rewrite");
  onPhase?.("preparing");
  assertTextLength(text, "The paraphraser", PARAPHRASE_MIN_WORDS);
  if (options.language !== "en") {
    throw new ApiError(
      "unsupported_language",
      `The rewriter built into this device works on English wording only. It was asked for ${LANGUAGE_NAMES[options.language] ?? options.language}.`,
      "Choose English, or attach a paraphrase service that covers that language.",
    );
  }
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That rewrite");
  onPhase?.("analyzing");
  await sleep(PHASE_PAUSE_MS);

  throwIfAborted(signal, "That rewrite");
  onPhase?.("scoring");
  const result = runParaphraseEngine(text, options);

  onPhase?.("reporting");
  await sleep(PHASE_PAUSE_MS / 2);
  return result;
}

export async function paraphraseText(
  text: string,
  options: ParaphraseRunOptions,
): Promise<ParaphraseResult> {
  return backendConfigured() ? paraphraseRemotely(text, options) : paraphraseLocally(text, options);
}

export function getParaphraseCapabilities(): ParaphraseCapabilities {
  const remote = backendConfigured();
  return {
    engine: remote ? "backend" : "local",
    modes: PARAPHRASE_MODES.map((mode) => mode.id),
    toneControl: remote,
    synonymLevelControl: true,
    // The bundled lexicon rewrites English wording; other codes need a service.
    languages: remote ? [...SUPPORTED_LANGUAGES] : ["en"],
  };
}

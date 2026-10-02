import type { AnalysisPhase, ServiceError } from "@/types";
import { backendConfigured } from "@/lib/api";
import { PHASE_PAUSE_MS, assertTextLength, sleep, throwIfAborted } from "@/lib/service";
import {
  SUPPORTED_LANGUAGES,
  TRANSLATION_UNAVAILABLE,
  detectLanguage,
  isSupportedCode,
  languageGroups,
  languageLabel,
  listSupportedLanguages,
  localTranslator,
  textDirection,
  translationSegments,
} from "@/lib/tools/translatorEngine";
import type {
  DetectedLanguage,
  LanguageOption,
  SupportedCode,
  SupportedLanguage,
  TranslationResult,
} from "@/lib/tools/translatorEngine";

export {
  SUPPORTED_LANGUAGES as TRANSLATION_LANGUAGES,
  TRANSLATION_UNAVAILABLE,
  isSupportedCode,
  languageGroups,
  languageLabel,
  listSupportedLanguages,
  textDirection,
  translationSegments,
};
export type {
  DetectedLanguage,
  LanguageOption,
  SupportedCode,
  SupportedLanguage,
  TranslationResult,
};

export interface TranslateOptions {
  source?: SupportedCode | "auto";
  target: SupportedCode;
  signal?: AbortSignal;
  onPhase?: (phase: AnalysisPhase) => void;
}

export interface TranslatorStatus {
  available: boolean;
  engine: "backend" | "local";
  languageCount: number;
  /** What the user is told when no translation service is attached. */
  note?: string;
  /** Detection does not need the backend, so it stays usable offline. */
  languageDetection: true;
}

export function getTranslatorStatus(): TranslatorStatus {
  const availability = localTranslator.availability();
  return {
    available: availability.available,
    engine: availability.engine,
    languageCount: SUPPORTED_LANGUAGES.length,
    note: availability.note,
    languageDetection: true,
  };
}

export function detectSourceLanguage(text: string): DetectedLanguage {
  return detectLanguage(text);
}

/** What this page can and cannot do without a backend, stated once. */
export const TRANSLATOR_NOTE =
  "Language detection on this page runs in your browser, from the letters and function words in the text. Translation itself is a backend call: this build ships no dictionary and no phrase book, so nothing here is ever a rearranged version of your text presented as another language.";

export function describeTranslationRun(result: TranslationResult): string {
  const source = languageLabel(result.sourceLanguage);
  const target = languageLabel(result.targetLanguage);
  return `${result.segments.length} sentence${result.segments.length === 1 ? "" : "s"}: ${source} → ${target}, returned by ${result.engine} in ${(result.processedMs / 1000).toFixed(1)} s.`;
}

/**
 * Translation is the one tool with no local stand-in: there is no dictionary engine
 * in this build, so an unattached backend surfaces as a stated error rather than
 * a rearranged version of the source text.
 */
export async function translateText(
  text: string,
  options: TranslateOptions,
): Promise<TranslationResult | ServiceError> {
  const { signal, onPhase } = options;
  throwIfAborted(signal, "That translation");
  onPhase?.("preparing");
  assertTextLength(text, "The translator", 1);

  if (!backendConfigured()) {
    return TRANSLATION_UNAVAILABLE;
  }

  onPhase?.("analyzing");
  await sleep(PHASE_PAUSE_MS);
  throwIfAborted(signal, "That translation");
  onPhase?.("scoring");
  return localTranslator.translate({ text, source: options.source, target: options.target });
}

import type { LanguageCode } from "@/types";

/**
 * Display names for the languages the detection engine accepts.
 * Codes are the engine's own list (`SUPPORTED_LANGUAGES` in detectorService);
 * the engine detects language from the text, so "Auto" is a real option rather
 * than a default the UI pretends to honour.
 */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
};

export interface LanguageChoice {
  code: LanguageCode | "auto";
  label: string;
}

export const DETECTOR_LANGUAGE_CHOICES: LanguageChoice[] = [
  { code: "auto", label: "Detect automatically" },
  ...(Object.keys(LANGUAGE_NAMES) as LanguageCode[]).map((code) => ({
    code,
    label: LANGUAGE_NAMES[code],
  })),
];

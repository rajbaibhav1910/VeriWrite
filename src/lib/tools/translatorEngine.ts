import type { LanguageCode, ServiceError } from "@/types";
import { ApiError, apiRequest, backendConfigured } from "@/lib/api";
import { normalizeText, splitSentences, tokenize } from "@/lib/text";

/**
 * Translation architecture. Detection is genuinely local (script ranges plus
 * per-language function-word scoring). Actual translation is a backend call:
 * there is no offline dictionary here and the engine never pretends otherwise.
 */

export type SupportedCode =
  | LanguageCode
  | "pl" | "cs" | "sk" | "hu" | "ro" | "bg" | "hr" | "sr" | "sl" | "uk" | "el" | "tr"
  | "sv" | "no" | "da" | "fi" | "et" | "lv" | "lt" | "is" | "ga" | "ca" | "eu" | "gl"
  | "nl" | "id" | "ms" | "vi" | "th" | "fil" | "sw" | "af" | "he" | "fa" | "ur" | "bn"
  | "ta" | "te" | "ml" | "mr" | "gu" | "kn" | "pa" | "ne" | "si" | "km" | "lo" | "my"
  | "ka" | "hy" | "az" | "kk" | "uz" | "am" | "yo" | "ha" | "zu" | "xh" | "mt" | "lb" | "mk" | "sq" | "be"
  | "es-419" | "bs" | "ps" | "ig" | "so" | "rw" | "mg" | "mi" | "haw" | "cy";

export interface SupportedLanguage {
  code: SupportedCode;
  label: string;
  nativeLabel: string;
  rtl?: boolean;
}

export interface LanguageOption {
  code: SupportedCode;
  label: string;
}

export interface DetectedLanguage {
  code: SupportedCode;
  label: string;
  /** 0-1; low values mean the sample was too short or mixed. */
  confidence: number;
  method: "script" | "lexicon" | "fallback";
}

export interface TranslationSegment {
  source: string;
  target: string;
}

export interface TranslationResult {
  sourceLanguage: SupportedCode;
  targetLanguage: SupportedCode;
  translated: string;
  segments: TranslationSegment[];
  engine: string;
  processedMs: number;
}

export interface TranslationRequest {
  text: string;
  target: SupportedCode;
  /** "auto" runs local detection first. */
  source?: SupportedCode | "auto";
}

export interface TranslatorEngine {
  readonly id: string;
  readonly languages: SupportedLanguage[];
  detect(text: string): DetectedLanguage;
  translate(request: TranslationRequest): Promise<TranslationResult>;
  /** Honest capability report for the UI. */
  availability(): { available: boolean; engine: "backend" | "local"; note?: string };
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "es-419", label: "Spanish (Latin America)", nativeLabel: "Español (Latinoamérica)" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands" },
  { code: "pl", label: "Polish", nativeLabel: "Polski" },
  { code: "cs", label: "Czech", nativeLabel: "Čeština" },
  { code: "sk", label: "Slovak", nativeLabel: "Slovenčina" },
  { code: "hu", label: "Hungarian", nativeLabel: "Magyar" },
  { code: "ro", label: "Romanian", nativeLabel: "Română" },
  { code: "bg", label: "Bulgarian", nativeLabel: "Български" },
  { code: "hr", label: "Croatian", nativeLabel: "Hrvatski" },
  { code: "sr", label: "Serbian", nativeLabel: "Српски" },
  { code: "sl", label: "Slovenian", nativeLabel: "Slovenščina" },
  { code: "mk", label: "Macedonian", nativeLabel: "Македонски" },
  { code: "bs", label: "Bosnian", nativeLabel: "Bosanski" },
  { code: "uk", label: "Ukrainian", nativeLabel: "Українська" },
  { code: "be", label: "Belarusian", nativeLabel: "Беларуская" },
  { code: "ru", label: "Russian", nativeLabel: "Русский" },
  { code: "el", label: "Greek", nativeLabel: "Ελληνικά" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe" },
  { code: "az", label: "Azerbaijani", nativeLabel: "Azərbaycanca" },
  { code: "sv", label: "Swedish", nativeLabel: "Svenska" },
  { code: "no", label: "Norwegian", nativeLabel: "Norsk" },
  { code: "da", label: "Danish", nativeLabel: "Dansk" },
  { code: "fi", label: "Finnish", nativeLabel: "Suomi" },
  { code: "et", label: "Estonian", nativeLabel: "Eesti" },
  { code: "lv", label: "Latvian", nativeLabel: "Latviešu" },
  { code: "lt", label: "Lithuanian", nativeLabel: "Lietuvių" },
  { code: "is", label: "Icelandic", nativeLabel: "Íslenska" },
  { code: "ga", label: "Irish", nativeLabel: "Gaeilge" },
  { code: "mt", label: "Maltese", nativeLabel: "Malti" },
  { code: "lb", label: "Luxembourgish", nativeLabel: "Lëtzebuergesch" },
  { code: "ca", label: "Catalan", nativeLabel: "Català" },
  { code: "gl", label: "Galician", nativeLabel: "Galego" },
  { code: "eu", label: "Basque", nativeLabel: "Euskara" },
  { code: "sq", label: "Albanian", nativeLabel: "Shqip" },
  { code: "hy", label: "Armenian", nativeLabel: "Hayeren" },
  { code: "ka", label: "Georgian", nativeLabel: "ქართული" },
  { code: "kk", label: "Kazakh", nativeLabel: "Қазақ тілі" },
  { code: "uz", label: "Uzbek", nativeLabel: "Oʻzbekcha" },
  { code: "zh", label: "Chinese (Simplified)", nativeLabel: "简体中文" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  { code: "th", label: "Thai", nativeLabel: "ไทย" },
  { code: "lo", label: "Lao", nativeLabel: "ລາວ" },
  { code: "km", label: "Khmer", nativeLabel: "ខ្មែរ" },
  { code: "my", label: "Burmese", nativeLabel: "မြန်မာ" },
  { code: "fil", label: "Filipino", nativeLabel: "Filipino" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "ms", label: "Malay", nativeLabel: "Bahasa Melayu" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { code: "ne", label: "Nepali", nativeLabel: "नेपाली" },
  { code: "si", label: "Sinhala", nativeLabel: "සිංහල" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", rtl: true },
  { code: "fa", label: "Persian", nativeLabel: "فارسی", rtl: true },
  { code: "ps", label: "Pashto", nativeLabel: "پښتو", rtl: true },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", rtl: true },
  { code: "he", label: "Hebrew", nativeLabel: "עברית", rtl: true },
  { code: "am", label: "Amharic", nativeLabel: "አማርኛ" },
  { code: "sw", label: "Swahili", nativeLabel: "Kiswahili" },
  { code: "ha", label: "Hausa", nativeLabel: "Hausa" },
  { code: "yo", label: "Yoruba", nativeLabel: "Yorùbá" },
  { code: "ig", label: "Igbo", nativeLabel: "Igbo" },
  { code: "zu", label: "Zulu", nativeLabel: "isiZulu" },
  { code: "xh", label: "Xhosa", nativeLabel: "isiXhosa" },
  { code: "af", label: "Afrikaans", nativeLabel: "Afrikaans" },
  { code: "so", label: "Somali", nativeLabel: "Soomaali" },
  { code: "rw", label: "Kinyarwanda", nativeLabel: "Kinyarwanda" },
  { code: "mg", label: "Malagasy", nativeLabel: "Malagasy" },
  { code: "mi", label: "Māori", nativeLabel: "Te Reo Māori" },
  { code: "haw", label: "Hawaiian", nativeLabel: "ʻŌlelo Hawaiʻi" },
  { code: "cy", label: "Welsh", nativeLabel: "Cymraeg" },
];

export const TRANSLATION_UNAVAILABLE: ServiceError = {
  code: "api",
  message: "Translation runs on the VeriWrite API service, which is not connected in this build.",
  hint: "Set VITE_API_BASE_URL to a backend that implements POST /api/translate, or copy the text into an external translator and bring the result back for analysis.",
};

export function listSupportedLanguages(): LanguageOption[] {
  return SUPPORTED_LANGUAGES.map(({ code, label }) => ({ code, label }));
}

export function isSupportedCode(value: string): value is SupportedCode {
  return SUPPORTED_LANGUAGES.some((language) => language.code === value);
}

const SCRIPT_TESTS: { code: SupportedCode; test: RegExp; minRatio?: number }[] = [
  // Kana is decisive for Japanese even though the sentence also carries Han characters.
  { code: "ja", test: /[\p{Script=Hiragana}\p{Script=Katakana}]/u },
  { code: "zh", test: /[\p{Script=Han}]/u },
  { code: "ko", test: /[\p{Script=Hangul}]/u },
  { code: "th", test: /[\p{Script=Thai}]/u },
  { code: "lo", test: /[\p{Script=Lao}]/u },
  { code: "km", test: /[\p{Script=Khmer}]/u },
  { code: "my", test: /[\p{Script=Myanmar}]/u },
  { code: "am", test: /[\p{Script=Ethiopic}]/u },
  { code: "hi", test: /[\p{Script=Devanagari}]/u },
  { code: "bn", test: /[\p{Script=Bengali}]/u },
  { code: "pa", test: /[\p{Script=Gurmukhi}]/u },
  { code: "gu", test: /[\p{Script=Gujarati}]/u },
  { code: "ta", test: /[\p{Script=Tamil}]/u },
  { code: "te", test: /[\p{Script=Telugu}]/u },
  { code: "ml", test: /[\p{Script=Malayalam}]/u },
  { code: "kn", test: /[\p{Script=Kannada}]/u },
  { code: "si", test: /[\p{Script=Sinhala}]/u },
  { code: "el", test: /[\p{Script=Greek}]/u },
  { code: "ar", test: /[\p{Script=Arabic}]/u },
  { code: "he", test: /[\p{Script=Hebrew}]/u },
  { code: "hy", test: /[\p{Script=Armenian}]/u },
  { code: "ka", test: /[\p{Script=Georgian}]/u },
  // Cyrillic narrows to the Slavic languages by their exclusive letters.
  // Exclusive letters are rare in a sentence, so these tests trip on a lower ratio.
  { code: "uk", test: /[іїєґ]/u, minRatio: 0.02 },
  { code: "mk", test: /[ѓѕ]/u, minRatio: 0.01 },
  { code: "sr", test: /[ђћњ]/u, minRatio: 0.01 },
  { code: "ru", test: /[\p{Script=Cyrillic}]/u },
];

/** Function words are the cheapest reliable signal for Latin-script languages. */
const LEXICAL_SIGNALS: { code: SupportedCode; words: string[]; diacritics: RegExp }[] = [
  { code: "en", words: ["the", "and", "of", "to", "is", "in", "that", "it", "for", "with", "are", "was", "this", "have", "not", "because", "already", "week"], diacritics: /[]/u },
  { code: "es", words: ["de", "que", "el", "los", "por", "una", "con", "para", "está", "también", "y", "en", "se", "las", "del", "este", "ha", "eran"], diacritics: /[ñ¿¡]/u },
  { code: "fr", words: ["le", "les", "des", "une", "est", "dans", "pour", "que", "avec", "pas", "très", "et", "de", "la", "ce", "publier", "parce", "étaient"], diacritics: /[œæç]/u },
  { code: "de", words: ["der", "die", "und", "das", "nicht", "mit", "für", "ein", "auch", "auf", "weil", "bereits", "hat", "den", "diese"], diacritics: /[äöüß]/u },
  { code: "pt", words: ["de", "que", "não", "uma", "para", "com", "isso", "mais", "como", "está", "e", "os", "já", "foram", "analisou", "decidiu"], diacritics: /[ãõçáéíóúâêôà]/u },
  { code: "it", words: ["di", "che", "per", "non", "con", "una", "sono", "questo", "anche", "come", "il", "la", "ha", "era", "pubblicarla"], diacritics: /[àèéìòù']/u },
  { code: "nl", words: ["het", "een", "van", "is", "niet", "met", "dat", "voor", "ook", "de", "en", "maar", " werd", "deze", "besloot", "reeds", "openbaar"], diacritics: /[]/u },
  { code: "af", words: ["die", "en", "nie", "met", "vir", "is", "het", "hierdie", "word", "baai", "reeds", "besluit", "om"], diacritics: /[]/u },
  { code: "pl", words: ["nie", "jest", "się", "jak", "dla", "przez", "który", "tym", "bardzo", "i", "do", "były", "już", "raport", "postanowiła"], diacritics: /[łążęśćźó]/u },
  { code: "cs", words: ["a", "je", "nebo", "pro", "jako", "který", "také", "velmi", "bez", "se", "to", "byl", "že", "tomuto", "týden", "zveřejnit"], diacritics: /[ěšžřůýáíéú]/u },
  { code: "sk", words: ["a", "je", "ale", "pre", "ako", "tiež", "veľmi", "sa", "to", "boli"], diacritics: /[ľĺŕôä]/u },
  { code: "sl", words: ["in", "je", "za", "ki", "so", "ne", "pred", "tem"], diacritics: /[šžč]/u },
  { code: "hr", words: ["i", "je", "za", "koji", "su", "ne", "bili", "objaviti"], diacritics: /[šžćčđ]/u },
  { code: "hu", words: ["nem", "hogy", "ez", "az", "egy", "van", "még", "kell", "és", "a", "meg", "már"], diacritics: /[őűáéíóú]/u },
  { code: "ro", words: ["și", "să", "în", "la", "un", "o", "cu", "este", "pentru", "care", "de", "din", "acest", "această", "a", "publica"], diacritics: /[șțăâî]/u },
  { code: "tr", words: ["bir", "bu", "için", "değil", "ve", "ile", "var", "gibi", "zaten", "karar", "verdi", "açıklan"], diacritics: /[ğıüşçö]/u },
  { code: "sv", words: ["och", "att", "det", "inte", "för", "med", "som", "har", "den", "denna", "vetan", "beslutade"], diacritics: /[åäö]/u },
  { code: "da", words: ["og", "at", "det", "ikke", "for", "med", "den", "har", "var", " denne", "ugentlige", "besluttede"], diacritics: /[æøå]/u },
  { code: "no", words: ["og", "at", "det", "ikke", "for", "med", "har", "bare", "denne", "beslutte"], diacritics: /[æøå]/u },
  { code: "fi", words: ["ja", "että", "ei", "on", "ovat", "sekä", "vain", "voidaan", "tällä", "viikolla", "koska"], diacritics: /[äö]/u },
  { code: "et", words: ["ja", "et", "ei", "on", "väga", "aga", "sest", "sellel", "nädalal"], diacritics: /[õäöü]/u },
  { code: "lv", words: ["un", "ka", "nav", "ar", "šo", "ir", "jo"], diacritics: /[āēīūļņšž]/u },
  { code: "lt", words: ["ir", "kad", "ne", "su", "šis", "yra", "nes"], diacritics: /[ąčęėįšųūž]/u },
  { code: "el", words: ["και", "δεν", "που", "με", "για", "είναι", "την", "ήταν"], diacritics: /[]/u },
  { code: "vi", words: ["và", "không", "được", "với", "cho", "những", "của", "bởi", "đã"], diacritics: /[ạảãàáạậầẩẹẻẽéẹểễịọỏõòóọởỡụủũúừứỳỷỹ]/u },
  { code: "id", words: ["dan", "yang", "tidak", "untuk", "dengan", "ini", "adalah", "karena", "sudah", "memutuskan"], diacritics: /[]/u },
  { code: "ms", words: ["dan", "yang", "tidak", "untuk", "dengan", "ini", "kerana", "sudah"], diacritics: /[]/u },
  { code: "uk", words: ["і", "не", "що", "для", "як", "це", "або", "були", "вже", "рішення"], diacritics: /[іїєґ]/u },
  { code: "ru", words: ["и", "не", "что", "для", "как", "это", "или", "поскольку", "были", "уже"], diacritics: /[ыэъё]/u },
  { code: "ca", words: ["que", "per", "amb", "una", "els", "aquest", "i", "ja"], diacritics: /[·àèéíòçü]/u },
  { code: "gl", words: ["que", "para", "con", "una", "non", "isto", "e", "xa"], diacritics: /[ñùáéíóú]/u },
  { code: "eu", words: ["eta", "ez", "baina", "izan", "du", "hori", "datuak"], diacritics: /[çü]/u },
  { code: "sw", words: ["na", "ya", "kwa", "hai", "ili", "hii", "sio", "amekagua"], diacritics: /[]/u },
  { code: "is", words: ["og", "að", "ekki", "för", "með", "þetta", "eru"], diacritics: /[þðæöéá]/u },
  { code: "ga", words: ["agus", "ní", "nach", "le", "ar", "tá", "seo"], diacritics: /[áéíóú]/u },
  { code: "cy", words: ["ac", "nid", "yr", "i", "gyda", "mae", "hyn"], diacritics: /[ŵŷâêîôûàèìòù]/u },
];

export function languageLabel(code: SupportedCode) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.label ?? code;
}

export function detectLanguage(text: string): DetectedLanguage {
  const clean = normalizeText(text);
  const letters = clean.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3) {
    return { code: "en", label: languageLabel("en"), confidence: 0, method: "fallback" };
  }

  for (const entry of SCRIPT_TESTS) {
    const marks = [...clean].filter((char) => entry.test.test(char)).length;
    if (marks / letters.length > (entry.minRatio ?? 0.12)) {
      return { code: entry.code, label: languageLabel(entry.code), confidence: Math.min(0.99, 0.6 + marks / letters.length), method: "script" };
    }
  }

  const words = tokenize(clean.toLowerCase());
  const scored = LEXICAL_SIGNALS.map((entry) => {
    const set = new Set(entry.words);
    let hits = 0;
    for (const word of words) if (set.has(word)) hits += 1;
    const marks = entry.diacritics.source === "[]" ? 0 : [...clean].filter((char) => entry.diacritics.test(char)).length;
    return { code: entry.code, score: hits / Math.max(1, words.length) + (marks / letters.length) * 0.6 };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runner = scored[1];
  if (!best || best.score < 0.02) {
    return { code: "en", label: languageLabel("en"), confidence: 0.15, method: "fallback" };
  }
  const gap = runner ? best.score - runner.score : best.score;
  const confidence = Math.min(0.95, Math.max(0.2, best.score * 4 + gap * 2));
  return { code: best.code, label: languageLabel(best.code), confidence: Math.round(confidence * 100) / 100, method: "lexicon" };
}

export function textDirection(code: SupportedCode): "rtl" | "ltr" {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.rtl ? "rtl" : "ltr";
}

/**
 * Group headings for the language pickers. Derived from the letters of each language's
 * own name rather than hand-curated, so adding a language to the registry cannot leave
 * it sitting in the wrong group.
 */
const SCRIPT_GROUPS: { name: string; test: RegExp }[] = [
  { name: "Latin", test: /\p{Script=Latin}/u },
  { name: "Cyrillic", test: /\p{Script=Cyrillic}/u },
  { name: "Greek", test: /\p{Script=Greek}/u },
  { name: "Arabic", test: /\p{Script=Arabic}/u },
  { name: "Hebrew", test: /\p{Script=Hebrew}/u },
  {
    name: "South Asian",
    test: /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}]/u,
  },
  { name: "East Asian", test: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u },
  {
    name: "South-East Asian",
    test: /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u,
  },
  { name: "Other scripts", test: /[\p{Script=Armenian}\p{Script=Georgian}\p{Script=Ethiopic}]/u },
];

function scriptGroupOf(language: SupportedLanguage) {
  const letters = [...language.nativeLabel].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return SCRIPT_GROUPS.length;
  let best = SCRIPT_GROUPS.length;
  let bestRatio = 0;
  SCRIPT_GROUPS.forEach((group, order) => {
    const marks = letters.filter((char) => group.test.test(char)).length;
    const ratio = marks / letters.length;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = order;
    }
  });
  return best;
}

export function languageGroups(
  list: SupportedLanguage[] = SUPPORTED_LANGUAGES,
): { name: string; languages: SupportedLanguage[] }[] {
  const buckets = new Map<number, SupportedLanguage[]>();
  for (const language of list) {
    const order = scriptGroupOf(language);
    const bucket = buckets.get(order);
    if (bucket) bucket.push(language);
    else buckets.set(order, [language]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([order, languages]) => ({
      name: SCRIPT_GROUPS[order]?.name ?? "Other",
      languages: languages.sort((a, b) => a.label.localeCompare(b.label, "en")),
    }));
}

/** Splits text into the segments a backend would translate, so results can be aligned. */
export function translationSegments(text: string): TranslationSegment[] {
  return splitSentences(normalizeText(text)).map((span) => ({ source: span.text, target: "" }));
}

function guardTranslationPayload(payload: TranslationResult, request: TranslationRequest): TranslationResult {
  const translated = typeof payload.translated === "string" ? payload.translated : "";
  if (!translated.trim()) {
    throw new ApiError("api", "The translation service answered, but sent no text back.", "Try again, or send a shorter passage.");
  }
  const segments: TranslationSegment[] = Array.isArray(payload.segments)
    ? payload.segments
        .filter((segment): segment is TranslationSegment =>
          Boolean(segment) && typeof segment.source === "string" && typeof segment.target === "string")
        .map((segment) => ({ source: segment.source, target: segment.target }))
    : [];
  return {
    sourceLanguage: isSupportedCode(String(payload.sourceLanguage)) ? payload.sourceLanguage : request.source && request.source !== "auto" ? request.source : detectLanguage(request.text).code,
    targetLanguage: isSupportedCode(String(payload.targetLanguage)) ? payload.targetLanguage : request.target,
    translated,
    segments: segments.length > 0 ? segments : translationSegments(request.text),
    engine: typeof payload.engine === "string" && payload.engine ? payload.engine : "translation service",
    processedMs: Number.isFinite(payload.processedMs) && (payload.processedMs as number) >= 0 ? payload.processedMs : 0,
  };
}

export const localTranslator: TranslatorEngine = {
  id: "veriwrite-translator",
  languages: SUPPORTED_LANGUAGES,
  detect: detectLanguage,
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const started = Date.now();
    if (!backendConfigured()) throw new ApiError(TRANSLATION_UNAVAILABLE.code, TRANSLATION_UNAVAILABLE.message, TRANSLATION_UNAVAILABLE.hint);
    const source = request.source && request.source !== "auto" ? request.source : detectLanguage(request.text).code;
    const payload = await apiRequest<TranslationResult>("/api/translate", {
      method: "POST",
      body: {
        text: request.text,
        source,
        target: request.target,
        segments: translationSegments(request.text).map((segment) => segment.source),
      },
    });
    const guarded = guardTranslationPayload(payload, { ...request, source });
    return { ...guarded, processedMs: guarded.processedMs || Date.now() - started };
  },
  availability() {
    return backendConfigured()
      ? { available: true, engine: "backend" }
      : { available: false, engine: "local", note: TRANSLATION_UNAVAILABLE.message };
  },
};

export const translate = localTranslator.translate;
export const detect = localTranslator.detect;

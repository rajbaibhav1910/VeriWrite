/**
 * Namespaced client-side persistence.
 *
 * Everything VeriWrite stores locally is prefixed `vw.` so a deployment sharing a
 * origin with another app cannot collide, and so "clear my data" is auditable.
 */

const PREFIX = "vw.";

export const STORAGE_KEYS = {
  theme: `${PREFIX}theme`,
  sidebar: `${PREFIX}sidebar`,
  documents: `${PREFIX}documents`,
  folders: `${PREFIX}folders`,
  history: `${PREFIX}history`,
  reports: `${PREFIX}reports`,
  preferences: `${PREFIX}preferences`,
  usage: `${PREFIX}usage`,
  session: `${PREFIX}session`,
  /** Rich-text draft as editor HTML, so formatting survives a reload. */
  draftHtml: `${PREFIX}draft.html`,
  /** Plain-text draft for the paraphraser input. */
  paraphraseInput: `${PREFIX}paraphrase.input`,
  /** Plain-text draft for the humanizer input. */
  humanizerInput: `${PREFIX}humanizer.input`,
  /** Rich-text draft for the grammar workspace, kept apart from the detector's. */
  grammarHtml: `${PREFIX}grammar.html`,
  /** Rich-text draft for the plagiarism workspace. */
  plagiarismHtml: `${PREFIX}plagiarism.html`,
  /** Rich-text draft for the summarizer workspace. */
  summarizerHtml: `${PREFIX}summarizer.html`,
  /** Rich-text draft for the writing assistant workspace. */
  writerHtml: `${PREFIX}writer.html`,
  /** Plain-text draft for the translator input. */
  translatorInput: `${PREFIX}translator.input`,
  /** The citation list built on the citations page. */
  citations: `${PREFIX}citations`,
  /** Unfinished source record on the citations page. */
  citationDraft: `${PREFIX}citation.draft`,
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function available(): Storage | null {
  try {
    const probe = `${PREFIX}__probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    // Private mode, disabled storage or a quota of zero: run in memory instead.
    return null;
  }
}

const memory = new Map<string, string>();
let backend: Storage | null | undefined;

function store(): Storage | Map<string, string> {
  if (backend === undefined) backend = available();
  return backend ?? memory;
}

export function readRaw(key: string): string | null {
  const target = store();
  if (target instanceof Map) return target.get(key) ?? null;
  try {
    return target.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): boolean {
  const target = store();
  if (target instanceof Map) {
    target.set(key, value);
    return true;
  }
  try {
    target.setItem(key, value);
    return true;
  } catch {
    // Most often a quota error from storing very large documents.
    memory.set(key, value);
    return false;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function remove(key: string) {
  const target = store();
  if (target instanceof Map) target.delete(key);
  else target.removeItem(key);
}

export function clearAllAppData() {
  const target = store();
  const keys: string[] = [];
  if (target instanceof Map) {
    keys.push(...target.keys());
  } else {
    for (let i = 0; i < target.length; i += 1) {
      const key = target.key(i);
      if (key) keys.push(key);
    }
  }
  for (const key of keys) if (key.startsWith(PREFIX)) remove(key);
}

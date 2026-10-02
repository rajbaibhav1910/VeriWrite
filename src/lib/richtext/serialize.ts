/**
 * Plain text <-> editor document. Every intake path (clipboard, .txt/.md upload,
 * saved-document import, built-in example) hands us plain text, and the detection
 * engine only ever sees plain text, so these two directions are the whole contract.
 */

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds paragraphs from plain text with no markup assumption: a blank line opens a
 * new paragraph, a single line break becomes a hard break. Escaping first means text
 * that already contains tags is kept as visible characters instead of becoming HTML.
 */
export function textToEditorHtml(text: string): string {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (clean.trim().length === 0) return "";
  return clean
    .split(/\n{2,}/)
    .map((block) => block.replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, ""))
    .filter((block) => block.length > 0)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/** The string the analysis runs on: blocks separated the way a blank line separates them. */
export const DETECTION_BLOCK_SEPARATOR = "\n\n";

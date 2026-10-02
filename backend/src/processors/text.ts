/**
 * Text processing (spec §40): what a file may be, how big it may be, and what can
 * actually be read out of it here.
 *
 * The app's current upload path does its extraction in the browser
 * (`src/services/fileService.ts`), and the plain text it produces is what travels to the
 * detector. This module is the other half of that rule — the checks a file must pass
 * before it is trusted as text — plus the one extraction this process does itself.
 *
 * It deliberately refuses DOCX and PDF rather than pretending: those formats need real
 * parsers, the browser bundle has them, and a backend that returned a guessed body would
 * put unmeasured words in front of a detector.
 */
import { BadRequest } from "../schemas/wire.ts";

/** 10 MB: generous for a document, small enough that a body cap is not a denial of service. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The same character ceiling `schemas/wire.ts` puts on a text field. */
export const MAX_TEXT_CHARS = 200_000;

export interface UploadSummary {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

const PLAIN_TEXT = new Set(["text/plain", "text/markdown"]);
const NEEDS_LOCAL_PARSER = new Map<string, string>([
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "DOCX is unpacked in the browser by the app's own file service; this process has no DOCX parser attached.",
  ],
  [
    "application/pdf",
    "PDF text is extracted in the browser by the app's own file service; this process has no PDF text layer reader attached.",
  ],
]);

/**
 * Whether a file may be accepted, and what happens to it. `extractable` is the honest
 * answer to "can this process read it", not "is the name familiar".
 */
export function inspectUpload(file: UploadSummary): {
  accept: boolean;
  extractable: boolean;
  reason: string;
} {
  if (file.sizeBytes <= 0) {
    return { accept: false, extractable: false, reason: "The file is empty." };
  }
  if (file.sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      accept: false,
      extractable: false,
      reason: `The file is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`,
    };
  }
  if (PLAIN_TEXT.has(file.mimeType)) {
    return { accept: true, extractable: true, reason: "Plain text, read here." };
  }
  const note = NEEDS_LOCAL_PARSER.get(file.mimeType);
  if (note) return { accept: true, extractable: false, reason: note };
  return {
    accept: false,
    extractable: false,
    reason: `A file of type "${file.mimeType || "unknown"}" is not one this service accepts.`,
  };
}

/** A TXT/MD body, decoded and checked the same way a pasted text is. */
export function decodePlainText(bytes: Uint8Array): string {
  // A UTF-8 byte order mark is stripped: it is invisible in an editor and would otherwise
  // sit at offset 0 of the text the detector measures.
  const text = new TextDecoder("utf-8", { ignoreBOM: true })
    .decode(bytes)
    .replace(/^\uFEFF/, "");
  if (text.length > MAX_TEXT_CHARS) {
    throw new BadRequest(`The extracted text is longer than ${MAX_TEXT_CHARS} characters.`);
  }
  if (text.trim().length === 0) throw new BadRequest("The file contains no text to read.");
  return text;
}

/** The ceiling a caller must check before it puts extracted text on the wire. */
export function assertTextSize(text: string): void {
  if (text.length > MAX_TEXT_CHARS) {
    throw new BadRequest(`The text is longer than ${MAX_TEXT_CHARS} characters.`);
  }
}

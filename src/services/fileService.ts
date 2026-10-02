import type { ServiceError } from "@/types";
import { ApiError, backendConfigured, uploadFile } from "@/lib/api";

/**
 * Document intake for every tool that reads a file.
 *
 * Plain text is read in the browser. `.docx` and `.pdf` need a converter, and this
 * copy of VeriWrite does not pretend to own one: with no backend attached those
 * types are refused with the reason and a working alternative, rather than
 * shipping a fabricated extraction.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const PLAIN_TEXT_EXTENSIONS = ["txt", "md", "markdown"] as const;
export const CONVERTED_EXTENSIONS = ["docx", "pdf"] as const;
export const ACCEPT_ATTRIBUTE = ".txt,.md,.docx,.pdf";

export const ACCEPTED_EXTENSIONS: string[] = [
  ...new Set([...PLAIN_TEXT_EXTENSIONS, ...CONVERTED_EXTENSIONS]),
];

export interface UploadSupport {
  /** Read in the browser, no service needed. */
  plain: string[];
  /** Only readable when a document service is attached. */
  converted: string[];
  serviceReady: boolean;
  maxBytes: number;
}

export function describeUploadSupport(): UploadSupport {
  return {
    plain: [...new Set(PLAIN_TEXT_EXTENSIONS)],
    converted: [...CONVERTED_EXTENSIONS],
    serviceReady: backendConfigured(),
    maxBytes: MAX_UPLOAD_BYTES,
  };
}

export interface ExtractedText {
  text: string;
  filename: string;
  extension: string;
  /** "browser" for plain text, "document-service" for converted types. */
  source: "browser" | "document-service";
  characters: number;
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * The 5 MB ceiling is a validation rule, not a preference: an oversized upload is
 * refused before any of it is read.
 */
function validateFile(file: File): string {
  const extension = extensionOf(file.name);
  if (!extension) {
    throw new ApiError(
      "unsupported_file",
      `${file.name || "That file"} has no file extension, so its type cannot be checked.`,
      "Supported types: .txt, .md, .docx and .pdf.",
    );
  }
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    throw new ApiError(
      "unsupported_file",
      `${file.name} is a .${extension} file. VeriWrite reads .txt, .md, .docx and .pdf.`,
      "Export the document as .txt or .pdf, or paste the text directly.",
    );
  }
  if (file.size === 0) {
    throw new ApiError("invalid_file", `${file.name} is empty.`, "Upload a file with text in it.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(
      "invalid_file",
      `${file.name} is ${formatBytes(file.size)}. Uploads are limited to ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      "Split the document into smaller files.",
    );
  }
  return extension;
}

async function extractPlain(file: File, extension: string): Promise<ExtractedText> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new ApiError(
      "invalid_file",
      `${file.name} could not be read from this device.`,
      "Try downloading it again, or paste the text instead.",
    );
  }
  // UTF-16 and some exports arrive with a BOM that would otherwise sit in the text.
  const stripped = text.replace(/^\uFEFF/, "");
  if (stripped.trim().length === 0) {
    throw new ApiError(
      "invalid_file",
      `${file.name} contains no readable text.`,
      "Check the file was saved as plain text rather than as an image or blank document.",
    );
  }
  return {
    text: stripped,
    filename: file.name,
    extension,
    source: "browser",
    characters: stripped.length,
  };
}

/** Shape check on the converter response: a service that returns junk must not poison the editor. */
function guardExtractPayload(payload: unknown, filename: string): string {
  if (typeof payload === "string") return payload;
  if (typeof payload === "object" && payload !== null) {
    const candidate = (payload as Record<string, unknown>).text;
    if (typeof candidate === "string") return candidate;
  }
  throw new ApiError(
    "api",
    `The document service accepted ${filename} but did not return any text.`,
    "Paste the text instead while this is being looked into.",
  );
}

async function extractConverted(file: File, extension: string): Promise<ExtractedText> {
  if (!backendConfigured()) {
    throw new ApiError(
      "unsupported_file",
      `.${extension} files need the document conversion service, which is not attached to this copy of VeriWrite.`,
      "Open the document, copy its text and paste it into the editor — the analysis is identical once the text is in.",
    );
  }
  const payload = await uploadFile<unknown>("/api/files/extract", file, { kind: "detector" });
  const text = guardExtractPayload(payload, file.name);
  if (text.trim().length === 0) {
    throw new ApiError(
      "invalid_file",
      `${file.name} has no selectable text. Scanned documents need OCR, which is not part of this service.`,
      "Run OCR over the pages first, or paste the text.",
    );
  }
  return {
    text,
    filename: file.name,
    extension,
    source: "document-service",
    characters: text.length,
  };
}

export type ExtractOutcome =
  | { status: "ok"; file: ExtractedText }
  | { status: "error"; error: ServiceError };

/** Never throws: callers render the error state instead of catching per-site. */
export async function extractTextFromFile(file: File): Promise<ExtractOutcome> {
  try {
    const extension = validateFile(file);
    const result = PLAIN_TEXT_EXTENSIONS.includes(extension as (typeof PLAIN_TEXT_EXTENSIONS)[number])
      ? await extractPlain(file, extension)
      : await extractConverted(file, extension);
    return { status: "ok", file: result };
  } catch (error) {
    if (error instanceof ApiError) return { status: "error", error: { code: error.code, message: error.message, hint: error.hint } };
    return {
      status: "error",
      error: {
        code: "unknown",
        message: error instanceof Error ? error.message : `${file.name} could not be processed.`,
      },
    };
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

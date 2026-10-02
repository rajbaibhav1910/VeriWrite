import { ApiError } from "@/lib/api";
import { countWords } from "@/lib/text";
import { MAX_WORDS, MIN_WORDS } from "@/lib/utils";

/** Small pause between progress phases so the UI can show real stages, not a spinner. */
export const PHASE_PAUSE_MS = 90;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function throwIfAborted(signal?: AbortSignal, label = "That run"): void {
  if (signal?.aborted) {
    throw new ApiError(
      "timeout",
      `${label} was cancelled before it finished.`,
      "Run it again when you are ready.",
    );
  }
}

/** Shared input guard: reports a specific, actionable error instead of a truncated result. */
export function assertTextLength(
  text: string,
  tool: string,
  min = MIN_WORDS,
  max = MAX_WORDS,
): number {
  const words = countWords(text);
  if (words < min) {
    throw new ApiError(
      "text_too_short",
      `${tool} needs at least ${min} ${min === 1 ? "word" : "words"}. This has ${words}.`,
      "Paste or type more text to work on.",
    );
  }
  if (words > max) {
    throw new ApiError(
      "text_too_long",
      `${tool} accepts up to ${max} words per run. This has ${words}.`,
      "Split the document and run the parts one at a time.",
    );
  }
  return words;
}

/** Remote payloads are untrusted: fail loudly rather than feeding the UI a half-shape. */
export function requireRecord(value: unknown, service: string): Record<string, unknown> {
  // `typeof [] === "object"`, so an array has to be turned away by name: reading the
  // fields off one yields undefined everywhere and a page full of tidy zeros.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError("api", `The ${service} service returned an unexpected response shape.`);
  }
  return value as Record<string, unknown>;
}

export function requireString(
  source: Record<string, unknown>,
  field: string,
  service: string,
): string {
  const value = source[field];
  if (typeof value !== "string") {
    throw new ApiError("api", `The ${service} service returned no ${field}.`);
  }
  return value;
}

export function optionalNumber(source: Record<string, unknown>, field: string, fallback = 0): number {
  const value = source[field];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

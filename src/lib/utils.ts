import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Classification, ConfidenceLevel, IssueCategory } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Scores are always shown as rounded integers; the value itself is an estimate. */
export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return formatDate(iso);
}

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  ai_generated: "AI-generated",
  ai_generated_refined: "AI-generated & AI-refined",
  human_refined: "Human-written & AI-refined",
  human_written: "Human-written",
};

export const CLASSIFICATION_DESCRIPTION: Record<Classification, string> = {
  ai_generated:
    "Most of the measured signals in this text are characteristic of machine-generated prose.",
  ai_generated_refined:
    "The text reads largely as machine-generated, with edits layered on top of it.",
  human_refined:
    "A human voice dominates the text, with AI assistance visible in places.",
  human_written:
    "The measured signals are consistent with human authorship throughout.",
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  low: "Low confidence",
  moderate: "Moderate confidence",
  high: "High confidence",
  "very-high": "Very high confidence",
};

/** Category names as the grammar workspace shows them. */
export const ISSUE_CATEGORY_LABEL: Record<IssueCategory, string> = {
  grammar: "Grammar",
  spelling: "Spelling",
  punctuation: "Punctuation",
  clarity: "Clarity",
  style: "Style",
};

/** Short form shown next to scores; the full legal text lives in detectorService. */
export const DETECTION_DISCLAIMER_SHORT =
  "AI detection is probabilistic and can produce false positives and false negatives. Results should not be treated as definitive proof of authorship.";

/**
 * Texts shorter than this produce unreliable signal; the editor blocks
 * analysis below the threshold rather than showing noise as insight.
 */
export const MIN_WORDS = 15;
export const MAX_WORDS = 100_000;

/** Sample standard deviation; one value returns 0 because there is nothing to spread. */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1));
}

export function uid(prefix = "id") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

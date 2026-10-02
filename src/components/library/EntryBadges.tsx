import { Badge } from "@/components/ui/badge";
import { toneForProbability } from "@/components/charts/ScoreRing";
import { CLASSIFICATION_LABEL, CONFIDENCE_LABEL, formatPercent } from "@/lib/utils";
import type { AnalysisStatus, Classification, ConfidenceLevel, SignalKind } from "@/types";

const SIGNAL_BADGE: Record<SignalKind, "signal-ai" | "signal-human" | "signal-mixed" | "signal-neutral"> = {
  ai: "signal-ai",
  human: "signal-human",
  mixed: "signal-mixed",
  neutral: "signal-neutral",
};

/**
 * The stored estimate, tinted the same way the editor paints it. A likelihood is a
 * measurement, never a verdict, so it reads as a figure rather than a label.
 */
export function LikelihoodBadge({ value }: { value: number }) {
  return (
    <Badge variant={SIGNAL_BADGE[toneForProbability(value)]} size="sm" className="tabular">
      {formatPercent(value)}
    </Badge>
  );
}

export function ClassificationBadge({ value }: { value: Classification }) {
  return (
    <Badge variant="outline" size="sm" className="max-w-full truncate font-normal">
      {CLASSIFICATION_LABEL[value]}
    </Badge>
  );
}

export function ConfidenceBadge({ value }: { value: ConfidenceLevel }) {
  return (
    <Badge variant="subtle" size="sm">
      {CONFIDENCE_LABEL[value].replace(" confidence", "")}
    </Badge>
  );
}

const STATUS: Record<AnalysisStatus, { label: string; variant: "success" | "subtle" | "info" | "error" }> =
  {
    completed: { label: "Completed", variant: "success" },
    draft: { label: "Draft", variant: "subtle" },
    processing: { label: "Processing", variant: "info" },
    failed: { label: "Failed", variant: "error" },
  };

export function StatusBadge({ value }: { value: AnalysisStatus }) {
  const status = STATUS[value];
  return (
    <Badge variant={status.variant} size="sm">
      {status.label}
    </Badge>
  );
}

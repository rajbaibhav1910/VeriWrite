import { StepLoader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisPhase } from "@/types";

/** The engine reports these five stages; they are shown as the engine runs them. */
export const PHASE_ORDER: AnalysisPhase[] = [
  "preparing",
  "normalizing",
  "analyzing",
  "scoring",
  "reporting",
];

const STEPS: { label: string; description: string }[] = [
  { label: "Preparing text", description: "Checking the passage is long enough to measure." },
  { label: "Normalizing", description: "Cleaning spacing and line breaks, keeping positions stable." },
  { label: "Analyzing", description: "Splitting into sentences and measuring their patterns." },
  { label: "Scoring", description: "Turning the measurements into probabilities." },
  { label: "Generating report", description: "Assembling the document, paragraph and sentence results." },
];

/** Copy for the primary button, grouped the way the spec asks for three labels. */
export function analyzeButtonLabel(phase: AnalysisPhase | null) {
  switch (phase) {
    case "preparing":
    case "normalizing":
      return "Preparing text...";
    case "analyzing":
    case "scoring":
      return "Analyzing...";
    case "reporting":
      return "Generating report...";
    default:
      return "Analyze Text";
  }
}

export function AnalysisProgress({ phase }: { phase: AnalysisPhase }) {
  const current = Math.max(0, PHASE_ORDER.indexOf(phase));
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle>Running the analysis</CardTitle>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          The engine publishes each stage as it completes it.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <StepLoader steps={STEPS} current={current} />
        <div className="space-y-2 border-t border-border pt-4" aria-hidden="true">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}

import { useId, useState, type ReactNode } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScoreRing, toneForProbability, type ScoreTone } from "@/components/charts/ScoreRing";
import { ClassificationBreakdown } from "@/components/detector/ClassificationBreakdown";
import { ExplanationCards } from "@/components/detector/ExplanationCards";
import { explainDocument } from "@/lib/detection/explanations";
import { LANGUAGE_NAMES } from "@/config/languages";
import {
  CLASSIFICATION_DESCRIPTION,
  CLASSIFICATION_LABEL,
  CONFIDENCE_LABEL,
  DETECTION_DISCLAIMER_SHORT,
  formatDuration,
  formatNumber,
  standardDeviation,
} from "@/lib/utils";
import type { DetectionResult } from "@/types";

interface DashboardProps {
  result: DetectionResult;
  /** Where the text came from: typed, pasted, imported or uploaded. */
  sourceLabel?: string | null;
  /** The report actions, shown top-right of the result card. */
  actions?: ReactNode;
}

const PROGRESS_TONE: Record<ScoreTone, string> = {
  ai: "bg-error",
  human: "bg-success",
  mixed: "bg-warning",
  neutral: "bg-muted-foreground",
};

const BADGE_TONE: Record<ScoreTone, "error" | "success" | "warning" | "subtle"> = {
  ai: "error",
  human: "success",
  mixed: "warning",
  neutral: "subtle",
};

/**
 * The finished run, laid out as the spec's analysis workspace: the headline estimate,
 * the classification it maps to, the evidence behind it, then the four-class split and
 * the raw measurements. Every figure is read straight off the result the engine
 * returned — nothing here is estimated a second time.
 */
export function DetectionResultDashboard({ result, sourceLabel, actions }: DashboardProps) {
  const [showEvidence, setShowEvidence] = useState(true);
  const evidenceId = useId();
  const documentGroup = explainDocument(result);
  const tone = toneForProbability(result.aiProbability);
  const flagged = result.sentences.filter((sentence) => sentence.flagged).length;
  const scoreSpread = standardDeviation(result.sentences.map((sentence) => sentence.aiProbability));
  const analysedAt = new Date(result.analyzedAt);
  const timeLabel = Number.isNaN(analysedAt.getTime())
    ? null
    : analysedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <CardTitle>Analysis result</CardTitle>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {formatNumber(result.metrics.words)} words measured in{" "}
              {result.processingMs < 1000
                ? `${formatNumber(result.processingMs)} ms`
                : `${(result.processingMs / 1000).toFixed(1)} s`}
              {timeLabel ? ` at ${timeLabel}` : ""}
              {sourceLabel ? ` · from ${sourceLabel}` : ""}
            </p>
          </div>
          {actions}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <ScoreRing
              value={result.aiProbability}
              size={132}
              label="AI likelihood"
              sublabel="Estimated likelihood of AI involvement"
              tone={tone}
            />
            <div className="min-w-[9rem] flex-1 space-y-2">
              <Badge variant={BADGE_TONE[tone]} size="md">
                {CLASSIFICATION_LABEL[result.classification]}
              </Badge>
              <p className="text-2xs leading-relaxed text-muted-foreground">
                {CLASSIFICATION_DESCRIPTION[result.classification]}
              </p>
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-2xs tabular">
                  <span>AI {Math.round(result.aiProbability)}%</span>
                  <span>Human {Math.round(result.humanProbability)}%</span>
                </div>
                <Progress
                  value={result.aiProbability}
                  aria-label="Share of the measured signal attributed to AI versus human writing"
                  indicatorClassName={PROGRESS_TONE[tone]}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
            <p className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {CONFIDENCE_LABEL[result.confidence]}
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              Based on {formatNumber(result.metrics.words)} words across{" "}
              {formatNumber(result.metrics.sentences)} sentences, whose estimates spread{" "}
              {scoreSpread.toFixed(0)} points around the document figure. Language read as{" "}
              {LANGUAGE_NAMES[result.language]}.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-border bg-surface-sunken p-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {DETECTION_DISCLAIMER_SHORT}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-3">
          <div className="min-w-0">
            <CardTitle>Why this text reads the way it does</CardTitle>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              One card per pattern the engine named across the text.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowEvidence((value) => !value)}
            aria-expanded={showEvidence}
            aria-controls={evidenceId}
          >
            {showEvidence ? "Hide evidence" : "Show evidence"}
          </Button>
        </CardHeader>
        {showEvidence ? (
          <CardContent id={evidenceId}>
            <ExplanationCards
              group={documentGroup}
              spanLabel={`${formatNumber(result.metrics.words)} words`}
            />
          </CardContent>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <ClassificationBreakdown result={result} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle>Measured from the text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-2xs sm:grid-cols-3">
            <Metric label="Sentences" value={formatNumber(result.metrics.sentences)} />
            <Metric label="Paragraphs" value={formatNumber(result.metrics.paragraphs)} />
            <Metric label="Flagged sentences" value={formatNumber(flagged)} />
            <Metric
              label="Avg sentence length"
              value={`${result.metrics.averageSentenceLength.toFixed(1)} words`}
            />
            <Metric label="Burstiness" value={result.metrics.burstiness.toFixed(1)} />
            <Metric label="Readability" value={result.metrics.readabilityLabel || "—"} />
            <Metric
              label="Vocabulary spread"
              value={`${(result.metrics.vocabularyDiversity * 100).toFixed(0)}%`}
            />
            <Metric label="Reading time" value={formatDuration(result.metrics.readingTimeSeconds)} />
            <Metric label="Characters" value={formatNumber(result.metrics.characters)} />
          </dl>

          <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Engine {result.engine} v{result.engineVersion}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular text-foreground">{value}</dd>
    </div>
  );
}

import { ArrowLeft, ArrowRight, ListChecks, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  SENTENCE_FILTER_LABEL,
  SENTENCE_FILTERS,
  filterCounts,
  type SentenceFilter,
} from "@/lib/detection/filters";
import { ExplanationCards } from "@/components/detector/ExplanationCards";
import { explainSentence } from "@/lib/detection/explanations";
import { bandFor } from "@/lib/detection/model";
import { SIGNAL_KIND_LABEL, SIGNAL_NAME_LABEL } from "@/lib/detection/signals";
import {
  CLASSIFICATION_LABEL,
  CONFIDENCE_LABEL,
  DETECTION_DISCLAIMER_SHORT,
  formatNumber,
} from "@/lib/utils";
import type { DetectedSignal, SentenceAnalysis } from "@/types";

interface SentenceInspectorProps {
  sentences: SentenceAnalysis[];
  /** Document-level signals, used as context when a sentence has none of its own. */
  documentSignals: DetectedSignal[];
  /** "engine vversion", so the cards can name what measured them. */
  engineLabel: string;
  filter: SentenceFilter;
  onFilterChange(filter: SentenceFilter): void;
  selected: number | null;
  onSelect(index: number | null): void;
  showScores: boolean;
  onShowScoresChange(value: boolean): void;
  showConfidence: boolean;
  onShowConfidenceChange(value: boolean): void;
  showExplanations: boolean;
  onShowExplanationsChange(value: boolean): void;
  /** Sentences actually painted under the current filter. */
  painted: number;
  /** Sentences the editor could not place, and why. */
  unmapped: number;
  mappingReason: string | null;
}

/**
 * The sentence workspace: filters decide which findings are painted, the flagged
 * steppers move through them, and the panel below shows the one that is open. The
 * engine's own sentence numbers are used throughout, so a panel and a highlight
 * can never disagree about which sentence they mean.
 */
export function SentenceInspector({
  sentences,
  documentSignals,
  engineLabel,
  filter,
  onFilterChange,
  selected,
  onSelect,
  showScores,
  onShowScoresChange,
  showConfidence,
  onShowConfidenceChange,
  showExplanations,
  onShowExplanationsChange,
  painted,
  unmapped,
  mappingReason,
}: SentenceInspectorProps) {
  const counts = filterCounts(sentences);
  const flagged = sentences.filter((sentence) => sentence.flagged);
  const current = sentences.find((sentence) => sentence.index === selected) ?? null;
  const flaggedPosition = flagged.findIndex((sentence) => sentence.index === selected);
  const group =
    current && showExplanations ? explainSentence(current, documentSignals, engineLabel) : null;

  function step(direction: 1 | -1) {
    if (flagged.length === 0) return;
    // Starting from nothing selected, or from a sentence the filter hid, the first
    // step lands on the end of the flagged list rather than somewhere in the middle.
    const next =
      flaggedPosition === -1
        ? direction === 1
          ? 0
          : flagged.length - 1
        : (flaggedPosition + direction + flagged.length) % flagged.length;
    onSelect(flagged[next].index);
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Sentence findings
            </h3>
            <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
              {formatNumber(painted)} of {formatNumber(sentences.length)} sentences painted
              {unmapped > 0
                ? ` · ${formatNumber(unmapped)} could not be placed (${mappingReason ?? "the offsets no longer match this document"})`
                : ""}
            </p>
          </div>

          <SegmentedControl
            size="sm"
            label="Filter sentences"
            value={filter}
            onChange={onFilterChange}
            options={SENTENCE_FILTERS.map((value) => ({
              value,
              label: SENTENCE_FILTER_LABEL[value],
              count: counts[value],
              disabled: value !== "all" && counts[value] === 0,
            }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-4 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-2xs text-muted-foreground">
            <Switch
              size="sm"
              checked={showScores}
              onCheckedChange={onShowScoresChange}
              aria-label="Show sentence scores"
            />
            Show sentence scores
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-2xs text-muted-foreground">
            <Switch
              size="sm"
              checked={showConfidence}
              onCheckedChange={onShowConfidenceChange}
              aria-label="Show confidence"
            />
            Show confidence
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-2xs text-muted-foreground">
            <Switch
              size="sm"
              checked={showExplanations}
              onCheckedChange={onShowExplanationsChange}
              aria-label="Show explanations"
            />
            Show explanations
          </label>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onFilterChange("flagged")}
              disabled={flagged.length === 0}
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              Show all flagged sections
            </Button>
            <Button
              type="button"
              variant="subtle"
              size="icon-sm"
              onClick={() => step(-1)}
              disabled={flagged.length === 0}
              aria-label="Previous flagged sentence"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="subtle"
              size="icon-sm"
              onClick={() => step(1)}
              disabled={flagged.length === 0}
              aria-label="Next flagged sentence"
            >
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {current ? (
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" size="sm">
                Sentence {current.index + 1} of {sentences.length}
              </Badge>
              <Badge
                size="sm"
                variant={
                  current.signal === "ai"
                    ? "signal-ai"
                    : current.signal === "human"
                      ? "signal-human"
                      : current.signal === "mixed"
                        ? "signal-mixed"
                        : "signal-neutral"
                }
              >
                {SIGNAL_KIND_LABEL[current.signal]}
              </Badge>
              {current.flagged ? (
                <Badge size="sm" variant="warning">
                  Flagged
                </Badge>
              ) : null}
              <span className="ml-auto text-2xs text-muted-foreground">
                {formatNumber(current.wordCount)} words ·{" "}
                {CLASSIFICATION_LABEL[bandFor(current.aiProbability)]}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onSelect(null)}
                aria-label="Close sentence panel"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </div>

            <p className="mt-2.5 border-l-2 border-border pl-3 text-sm leading-relaxed text-foreground">
              {current.text}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
              <div>
                <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Estimated AI likelihood
                </p>
                <p className="text-xl font-semibold tabular leading-tight">
                  {current.aiProbability}%
                </p>
                <Progress
                  value={current.aiProbability}
                  aria-label={`Estimated AI likelihood for sentence ${current.index + 1}`}
                  indicatorClassName={
                    current.signal === "ai"
                      ? "bg-signal-ai"
                      : current.signal === "human"
                        ? "bg-signal-human"
                        : "bg-signal-mixed"
                  }
                />
              </div>

              <div className="space-y-2">
                {showConfidence ? (
                  <p className="text-2xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {CONFIDENCE_LABEL[current.confidence]}
                    </span>{" "}
                    · human side {current.humanProbability}%
                  </p>
                ) : null}

                {showExplanations ? (
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    {current.signals.length > 0
                      ? "The patterns the engine named for this sentence are carded below."
                      : "No pattern fired in this sentence on its own, so the cards below show the strongest patterns from the whole text as context."}
                  </p>
                ) : current.signals.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {current.signals.map((signal) => (
                      <li key={signal.name}>
                        <Badge variant="subtle" size="sm">
                          {SIGNAL_NAME_LABEL[signal.name]}
                          <span className="tabular opacity-70">
                            {Math.round(signal.weight * 100)}%
                          </span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-2xs text-muted-foreground">
                    No single signal stood out; this sentence was scored on the document pattern
                    alone.
                  </p>
                )}
              </div>
            </div>

            {group ? (
              <div className="mt-3 border-t border-border pt-3">
                <ExplanationCards
                  group={group}
                  spanLabel={`Sentence ${current.index + 1} of ${sentences.length}`}
                />
              </div>
            ) : null}

            {showExplanations ? null : (
              <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                These are pattern observations on one sentence, not a judgement about who wrote it.{" "}
                {DETECTION_DISCLAIMER_SHORT}
              </p>
            )}
          </div>
        ) : (
          <p className="px-4 py-3 text-2xs leading-relaxed text-muted-foreground">
            Click a highlighted sentence to open its finding, or step through the flagged ones with
            the arrows. {formatNumber(flagged.length)} of {formatNumber(sentences.length)} sentences
            are flagged by the engine.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

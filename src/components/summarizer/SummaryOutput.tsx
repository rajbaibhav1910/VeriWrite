import { Copy, Download, Info, KeyRound, ListChecks, TextSelect } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { countWords, splitSentences } from "@/lib/text";
import { formatNumber } from "@/lib/utils";
import { SUMMARY_FORMATS, describeSummaryRun } from "@/services/summarizerService";
import type { SummaryResult } from "@/types";

export interface SummaryOutputProps {
  result: SummaryResult;
  /** The exact text the run read, so the figures describe a real document. */
  sourceText: string;
  /** The editor holds different text now, so this output is about the older one. */
  stale: boolean;
  onCopy(): void;
  onDownload(): void;
}

/**
 * The summarizer's three outputs, kept apart instead of blended into one block:
 * the summary, the key findings drawn from it, and the keywords measured from the
 * document. The summary body is the input's own sentences — in bullet formats they
 * are laid out as a list, but no wording is added.
 */
export function SummaryOutput({
  result,
  sourceText,
  stale,
  onCopy,
  onDownload,
}: SummaryOutputProps) {
  const summaryWords = countWords(result.summary);
  const sourceWords = countWords(sourceText);
  const kept = sourceWords === 0 ? 0 : Math.round((summaryWords / sourceWords) * 100);
  const format = SUMMARY_FORMATS.find((entry) => entry.id === result.format) ?? SUMMARY_FORMATS[0];
  const bullets = result.format !== "paragraph" ? splitSentences(result.summary).map((span) => span.text) : [];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <Badge variant="subtle" size="xs">
          {format.label}
        </Badge>
        <Badge variant={stale ? "warning" : "success"} size="xs">
          {stale ? "Input has changed" : `${formatNumber(summaryWords)} of ${formatNumber(sourceWords)} words`}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="size-3.5" aria-hidden />
            Copy
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDownload}>
            <Download className="size-3.5" aria-hidden />
            .txt
          </Button>
        </div>
      </div>

      <CardContent className="space-y-4 p-4">
        <div>
          {bullets.length > 0 ? (
            <ul className="space-y-1.5">
              {bullets.map((sentence, index) => (
                <li key={`${index}-${sentence.slice(0, 12)}`} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="min-w-0">{sentence}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed">{result.summary}</p>
          )}
          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
            {format.note} Every sentence above appears word for word in your text.
          </p>
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <ListChecks className="size-3.5" aria-hidden />
            Key findings
          </h3>
          {result.keyPoints.length === 0 ? (
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              The ranking kept no sentence to draw a finding from.
            </p>
          ) : (
            <ol className="mt-1.5 space-y-1">
              {result.keyPoints.map((point, index) => (
                <li key={`${index}-${point.slice(0, 12)}`} className="flex gap-2 text-xs leading-relaxed">
                  <span className="tabular text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0 text-foreground">{point}</span>
                </li>
              ))}
            </ol>
          )}
          {result.keyPoints.some((point) => point.endsWith("…")) ? (
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              A finding ending in “…” was cut short at a clause; the words shown are still the
              document's own.
            </p>
          ) : null}
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <KeyRound className="size-3.5" aria-hidden />
            Keywords
          </h3>
          {result.keywords.length === 0 ? (
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              No word in this text is frequent enough, and spread widely enough, to single out.
            </p>
          ) : (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {result.keywords.map((word) => (
                <li
                  key={word}
                  className="rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-2xs text-muted-foreground"
                >
                  {word}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <TextSelect className="size-3.5" aria-hidden />
              Compression
            </span>
            <span className="tabular">{Math.round(result.compressionRatio * 100)}%</span>
          </div>
          <Progress
            className="mt-1.5"
            value={kept}
            indicatorClassName={kept > 60 ? "bg-info" : "bg-primary"}
            aria-label={`The summary keeps ${kept}% of the document's words`}
          />
          <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
            {describeSummaryRun(result, sourceText)}
          </p>
        </div>

        {stale ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
            <span>
              You have edited the text since this run, so the summary above describes{" "}
              {formatNumber(sourceWords)} words that are no longer all in the editor. Run it again
              to summarise the text as it stands.
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

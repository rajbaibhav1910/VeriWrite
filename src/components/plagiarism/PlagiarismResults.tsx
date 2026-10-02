import { Link2, ScanText, ShieldAlert, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatNumber } from "@/lib/utils";
import type { PlagiarismRun } from "@/services/plagiarismService";

export interface PlagiarismResultsProps {
  scan: PlagiarismRun;
}

/**
 * The figures a scan produced, in the words the spec asks for: originality,
 * matched sources and potential matches. Everything here is read off the matches
 * the engine reported — no number is estimated at display time — and the notice
 * and engine label travel with the run so a demo scan cannot be shown as a web
 * scan.
 */
export function PlagiarismResults({ scan }: PlagiarismResultsProps) {
  const verbatim = scan.matches.filter((match) => match.kind === "verbatim").length;
  const paraphrase = scan.matches.length - verbatim;
  const matchedWords = scan.matches.reduce((total, match) => total + match.words, 0);
  const originality = scan.originality;
  const band =
    originality >= 90 ? "text-success" : originality >= 70 ? "text-warning" : "text-error";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Originality
          </h3>
          <Badge variant={scan.engine === "demo-corpus" ? "warning" : "info"} size="xs">
            {scan.engine === "demo-corpus" ? "Demo corpus" : "Similarity service"}
          </Badge>
        </div>

        <p className="mt-1 flex items-baseline gap-2">
          <span className={cn("text-3xl font-semibold leading-none tabular", band)}>
            {originality}%
          </span>
          <span className="text-2xs text-muted-foreground">
            of {formatNumber(scan.wordsScanned)} words unmatched
          </span>
        </p>

        <Progress
          className="mt-2"
          value={originality}
          indicatorClassName={
            originality >= 90 ? "bg-success" : originality >= 70 ? "bg-warning" : "bg-error"
          }
          aria-label={`Originality ${originality}%`}
        />

        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Figure
            icon={Link2}
            label="Matched sources"
            value={formatNumber(scan.sources.length)}
            note={`against ${formatNumber(scan.corpusSize)} passages`}
          />
          <Figure
            icon={ScanText}
            label="Potential matches"
            value={formatNumber(scan.matches.length)}
            note={`${verbatim} verbatim, ${paraphrase} reworded`}
          />
          <Figure
            icon={Type}
            label="Words matched"
            value={formatNumber(matchedWords)}
            note={`${scan.matchedPercentage}% of the text`}
          />
        </dl>

        <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-px size-4 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0">{scan.notice}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Link2;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-2">
      <dt className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold leading-tight tabular">{value}</dd>
      <dd className="text-2xs leading-relaxed text-muted-foreground">{note}</dd>
    </div>
  );
}

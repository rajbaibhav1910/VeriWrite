import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { CLASSIFICATION_BAND_RANGE } from "@/lib/detection/model";
import { REPORT_SIGNAL_WORD, type DetectionReport, type ReportFinding } from "@/lib/report";
import {
  CLASSIFICATION_LABEL,
  cn,
  formatDateTime,
  formatPercent,
} from "@/lib/utils";
import type { Classification } from "@/types";

const CLASS_ORDER: Classification[] = [
  "ai_generated",
  "ai_generated_refined",
  "human_refined",
  "human_written",
];

const CLASS_SWATCH: Record<Classification, string> = {
  ai_generated: "bg-signal-ai",
  ai_generated_refined: "bg-signal-mixed",
  human_refined: "bg-signal-human/55",
  human_written: "bg-signal-human",
};

const BAND_TONE: Record<Classification, "error" | "warning" | "success" | "subtle"> = {
  ai_generated: "error",
  ai_generated_refined: "warning",
  human_refined: "success",
  human_written: "success",
};

/**
 * The report as a document: the same sections, in the same order, that the PDF and
 * the downloaded HTML carry. Nothing here measures anything — every line is read off
 * the report the engine's result produced.
 */
export function ReportDocument({ report }: { report: DetectionReport }) {
  return (
    <article
      id="report-document"
      className="mx-auto w-full max-w-[52rem] space-y-6 rounded-lg border border-border bg-surface p-5 text-foreground sm:p-7 print:max-w-none print:rounded-none print:border-0 print:p-0"
    >
      <header className="space-y-1 border-b-2 border-foreground pb-3">
        <p className="text-2xs uppercase tracking-[0.12em] text-muted-foreground">
          VeriWrite · AI detection report
        </p>
        <h2 className="text-xl font-semibold leading-snug break-words">{report.title}</h2>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Generated {formatDateTime(report.generatedAt)} from an analysis dated{" "}
          {formatDateTime(report.analyzedAt)}.
        </p>
      </header>

      <Section title="Summary">
        <dl className="divide-y divide-border">
          {report.facts.map((item) => (
            <div key={item.label} className="grid gap-1 py-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-3">
              <dt className="text-2xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="min-w-0">
                <span className="text-xs font-medium break-words">{item.value}</span>
                <span className="mt-0.5 block text-2xs leading-relaxed text-muted-foreground">{item.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Classification breakdown">
        <div
          role="img"
          aria-label={CLASS_ORDER.filter((key) => report.breakdown[key] > 0)
            .map((key) => `${CLASSIFICATION_LABEL[key]} ${report.breakdown[key]}%`)
            .join(", ")}
          className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {CLASS_ORDER.map((key) =>
            report.breakdown[key] > 0 ? (
              <span
                key={key}
                aria-hidden
                className={cn("h-full", CLASS_SWATCH[key])}
                style={{ width: `${report.breakdown[key]}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 space-y-1.5">
          {CLASS_ORDER.map((key) => (
            <li key={key} className="flex flex-wrap items-baseline justify-between gap-2 text-2xs">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", CLASS_SWATCH[key])} />
                <span className="font-medium">{CLASSIFICATION_LABEL[key]}</span>
                <span className="text-muted-foreground">
                  AI likelihood {CLASSIFICATION_BAND_RANGE[key]}%
                </span>
              </span>
              <span className="tabular font-semibold">{report.breakdown[key]}%</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Sentence-level findings"
        note={`${report.flaggedCount} of ${report.findings.length} measured sentences crossed the flag line. Every sentence is listed so the flagged ones can be read in place.`}
      >
        {report.findings.length === 0 ? (
          <p className="text-2xs text-muted-foreground">The engine measured no sentences in this text.</p>
        ) : (
          <ol className="space-y-2">
            {report.findings.map((finding) => (
              <Finding key={finding.index} finding={finding} />
            ))}
          </ol>
        )}
      </Section>

      <Section title="Analytics">
        <dl className="divide-y divide-border">
          {report.analytics.map((metric) => (
            <div key={metric.label} className="grid gap-1 py-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-3">
              <dt className="text-2xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
                {metric.label}
              </dt>
              <dd className="min-w-0">
                <span className="text-xs font-medium tabular">{metric.value}</span>
                <span className="mt-0.5 block text-2xs leading-relaxed text-muted-foreground">{metric.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {report.text ? (
        <Section title="Text as measured" note="Kept with this report so the findings can be read in their setting.">
          <div className="space-y-2 text-xs leading-relaxed">
            {report.text.split(/\n{2,}/u).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-wrap break-words">
                {paragraph}
              </p>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken p-3">
        <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-2xs leading-relaxed text-muted-foreground">{report.disclaimer}</p>
      </div>

      <footer className="border-t border-border pt-3 text-2xs text-muted-foreground">
        Engine {report.engine} {report.engineVersion} · report {report.id} · version {report.version}
      </footer>
    </article>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 print:break-inside-avoid-page">
      <h3 className="text-2xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">{title}</h3>
      {note ? <p className="text-2xs leading-relaxed text-muted-foreground">{note}</p> : null}
      {children}
    </section>
  );
}

function Finding({ finding }: { finding: ReportFinding }) {
  return (
    <li
      className={cn(
        "rounded-md border border-border px-3 py-2 print:break-inside-avoid",
        finding.flagged && "border-error/35 bg-error-soft/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-2xs">
        <span className="tabular text-muted-foreground">Sentence {finding.index + 1}</span>
        <span className="tabular text-muted-foreground">paragraph {finding.paragraph + 1}</span>
        <span className="tabular text-muted-foreground">{finding.words} words</span>
        <Badge variant={BAND_TONE[finding.classification]} size="xs">
          {formatPercent(finding.aiProbability)} · {CLASSIFICATION_LABEL[finding.classification]}
        </Badge>
        {finding.flagged ? (
          <Badge variant="error" size="xs">
            flagged
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed break-words">{finding.text}</p>
      <p className="mt-1 text-2xs text-muted-foreground">
        {REPORT_SIGNAL_WORD[finding.signal]} · human side {formatPercent(finding.humanProbability)}
      </p>
    </li>
  );
}

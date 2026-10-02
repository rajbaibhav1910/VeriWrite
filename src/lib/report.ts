import { buildAnalytics, type AnalyticsMetric } from "@/lib/detection/analytics";
import { bandFor, CLASSIFICATION_BAND_RANGE } from "@/lib/detection/model";
import { PdfDocument, pdfBytes } from "@/lib/pdf";
import { formatDateTime, formatNumber, formatPercent, CLASSIFICATION_LABEL, CONFIDENCE_LABEL, DETECTION_DISCLAIMER_SHORT, uid } from "@/lib/utils";
import type { Classification, DetectionResult, SignalKind } from "@/types";

export const REPORT_KIND = "veriwrite.report" as const;
/** Bump when the shape below changes so older files and links can say so. */
export const REPORT_VERSION = 1;

export interface ReportFact {
  label: string;
  value: string;
  /** Where the figure came from, in a few words. */
  note: string;
}

export interface ReportFinding {
  index: number;
  paragraph: number;
  text: string;
  words: number;
  aiProbability: number;
  humanProbability: number;
  classification: Classification;
  /** The engine's own per-sentence read, not a restatement of it. */
  signal: SignalKind;
  flagged: boolean;
}

/**
 * A report is a plain description of one finished measurement. Everything in it
 * is copied or formatted from the engine's result: no figure is invented here,
 * and nothing is re-derived that the engine already decided.
 */
export interface DetectionReport {
  kind: typeof REPORT_KIND;
  version: number;
  id: string;
  generatedAt: string;
  title: string;
  documentId: string | null;
  analysisId: string;
  analyzedAt: string;
  engine: string;
  engineVersion: string;
  aiProbability: number;
  classification: Classification;
  confidence: string;
  words: number;
  facts: ReportFact[];
  breakdown: Record<Classification, number>;
  findings: ReportFinding[];
  flaggedCount: number;
  analytics: AnalyticsMetric[];
  disclaimer: string;
  /** Only present when the report was built to carry the writing itself. */
  text?: string;
}

export interface BuildReportInput {
  result: DetectionResult;
  title: string;
  documentId?: string | null;
  /** Pass the text to keep it inside the report; omit it for a figures-only file. */
  text?: string | null;
  id?: string;
  generatedAt?: string;
}

function fact(label: string, value: string, note: string): ReportFact {
  return { label, value, note };
}

export function buildReport(input: BuildReportInput): DetectionReport {
  const { result } = input;
  const analytics = buildAnalytics(result);
  const findings: ReportFinding[] = result.sentences.map((sentence) => ({
    index: sentence.index,
    paragraph: sentence.paragraphIndex,
    text: sentence.text,
    words: sentence.wordCount,
    aiProbability: sentence.aiProbability,
    humanProbability: sentence.humanProbability,
    classification: bandFor(sentence.aiProbability),
    signal: sentence.signal,
    flagged: sentence.flagged,
  }));

  const report: DetectionReport = {
    kind: REPORT_KIND,
    version: REPORT_VERSION,
    id: input.id ?? uid("report"),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    title: input.title,
    documentId: input.documentId ?? result.documentId ?? null,
    analysisId: result.analysisId,
    analyzedAt: result.analyzedAt,
    engine: result.engine,
    engineVersion: result.engineVersion,
    aiProbability: result.aiProbability,
    classification: result.classification,
    confidence: result.confidence,
    words: result.metrics.words,
    facts: [
      fact("Document", input.title, "The name the analysis was filed under."),
      fact("Analysis date", formatDateTime(result.analyzedAt), "When the engine measured the text."),
      fact("Word count", formatNumber(result.metrics.words), "Counted from the text that was measured."),
      fact("AI likelihood", formatPercent(result.aiProbability), "The engine's estimate, not a verdict on authorship."),
      fact("Classification", CLASSIFICATION_LABEL[result.classification], CLASSIFICATION_BAND_RANGE[result.classification]),
      fact("Confidence", CONFIDENCE_LABEL[result.confidence], "How clearly the signals separated from the middle band."),
      fact(
        "Sentences measured",
        formatNumber(result.sentences.length),
        `${formatNumber(result.metrics.paragraphs)} paragraphs, ${formatNumber(result.metrics.characters)} characters.`,
      ),
      fact("Engine", `${result.engine} ${result.engineVersion}`, "Which model produced these figures."),
    ],
    breakdown: result.breakdown,
    findings,
    flaggedCount: result.sentences.filter((sentence) => sentence.flagged).length,
    analytics: analytics.metrics,
    disclaimer: DETECTION_DISCLAIMER_SHORT,
  };

  if (input.text) report.text = input.text;
  return report;
}

/* ------------------------------------------------------------------ renderers */

/** Plain text for the clipboard: the headline figures, then the flagged sentences. */
export function reportSummaryText(report: DetectionReport): string {
  const lines = [
    `${report.title} — AI detection report`,
    `Generated ${formatDateTime(report.generatedAt)} from an analysis dated ${formatDateTime(report.analyzedAt)}.`,
    "",
    ...report.facts.map((item) => `${item.label}: ${item.value}`),
    "",
    "Classification breakdown",
    ...Object.entries(report.breakdown).map(
      ([key, value]) => `  ${CLASSIFICATION_LABEL[key as Classification]}: ${formatPercent(Number(value))}`,
    ),
    "",
    report.flaggedCount === 0
      ? "No sentence crossed the flag line for this measurement."
      : `Sentence-level findings (${report.flaggedCount} flagged of ${report.findings.length} measured)`,
    ...(report.flaggedCount === 0
      ? []
      : report.findings
          .filter((finding) => finding.flagged)
          .map(
            (finding) =>
              `  ${finding.index + 1}. ${formatPercent(finding.aiProbability)} ${
                CLASSIFICATION_LABEL[finding.classification]
              } — ${finding.text}`,
          )),
    "",
    "Analytics",
    ...report.analytics.map((metric) => `  ${metric.label}: ${metric.value} (${metric.note})`),
    "",
    report.disclaimer,
    "",
    `Engine: ${report.engine} ${report.engineVersion}. Report ${report.id}, version ${report.version}.`,
  ];
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** How the engine's per-sentence signal is put in a reader's words. */
export const REPORT_SIGNAL_WORD: Record<SignalKind, string> = {
  ai: "reads machine-like",
  human: "reads human-like",
  mixed: "reads mixed",
  neutral: "sits in the middle",
};

/**
 * A standalone HTML document: same content as the on-screen report, self-contained
 * so it opens anywhere and prints to a PDF through the browser's own engine.
 */
export function reportHtml(report: DetectionReport): string {
  const rows = report.facts
    .map(
      (item) =>
        `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td><td class="note">${escapeHtml(
          item.note,
        )}</td></tr>`,
    )
    .join("\n");

  const breakdown = Object.entries(report.breakdown)
    .map(
      ([key, value]) =>
        `<li>${escapeHtml(CLASSIFICATION_LABEL[key as Classification])}: ${escapeHtml(formatPercent(Number(value)))}</li>`,
    )
    .join("\n");

  const findings = report.findings
    .map(
      (finding) => `<tr class="${finding.flagged ? "flagged" : ""}">
      <td class="n">${finding.index + 1}</td>
      <td>${escapeHtml(finding.text)}</td>
      <td class="num">${escapeHtml(formatPercent(finding.aiProbability))}</td>
      <td>${escapeHtml(CLASSIFICATION_LABEL[finding.classification])}</td>
      <td>${escapeHtml(REPORT_SIGNAL_WORD[finding.signal])}</td>
    </tr>`,
    )
    .join("\n");

  const analytics = report.analytics
    .map(
      (metric) =>
        `<tr><th scope="row">${escapeHtml(metric.label)}</th><td>${escapeHtml(metric.value)}</td><td class="note">${escapeHtml(
          metric.note,
        )}</td></tr>`,
    )
    .join("\n");

  const body = report.text
    ? `<section><h2>Text as measured</h2><div class="source">${report.text
        .split(/\n{2,}/u)
        .map((para) => `<p>${escapeHtml(para)}</p>`)
        .join("\n")}</div></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(report.title)} — VeriWrite report</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f6f6f4; color: #1c1c1a; font: 14px/1.55 "Segoe UI", system-ui, -apple-system, sans-serif; }
  main { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.5rem 3.5rem; background: #fff; }
  header { border-bottom: 2px solid #1c1c1a; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .brand { font-size: .75rem; letter-spacing: .12em; text-transform: uppercase; color: #6b6b66; }
  h1 { font-size: 1.5rem; margin: .35rem 0 .25rem; }
  h2 { font-size: .95rem; letter-spacing: .04em; text-transform: uppercase; margin: 2rem 0 .5rem; padding-bottom: .25rem; border-bottom: 1px solid #e3e3df; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid #efefec; vertical-align: top; }
  table.facts th { width: 12rem; font-weight: 600; }
  .note, .num { color: #6b6b66; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .n { width: 2.5rem; color: #6b6b66; }
  tr.flagged td { background: #fdf3f2; }
  ul { margin: .25rem 0 0; padding-left: 1.1rem; }
  .disclaimer { margin-top: 2rem; padding: .9rem 1rem; border: 1px solid #e3e3df; background: #fafaf8; font-size: .85rem; }
  .source p { margin: 0 0 .8rem; white-space: pre-wrap; }
  footer { margin-top: 2rem; font-size: .8rem; color: #6b6b66; }
  @media print { body { background: #fff; } main { max-width: none; padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<main>
  <header>
    <div class="brand">VeriWrite &middot; AI detection report</div>
    <h1>${escapeHtml(report.title)}</h1>
    <div class="note">Generated ${escapeHtml(formatDateTime(report.generatedAt))} from an analysis dated ${escapeHtml(
      formatDateTime(report.analyzedAt),
    )}.</div>
  </header>

  <h2>Summary</h2>
  <table class="facts">
${rows}
  </table>

  <h2>Classification breakdown</h2>
  <ul>
${breakdown}
  </ul>

  <h2>Sentence-level findings</h2>
  <p class="note">${report.flaggedCount} of ${report.findings.length} measured sentences crossed the flag line. Every sentence is listed so the flagged ones can be read in place.</p>
  <table>
    <thead><tr><th class="n">#</th><th>Sentence</th><th class="num">AI likelihood</th><th>Band</th><th>Read</th></tr></thead>
    <tbody>
${findings}
    </tbody>
  </table>

  <h2>Analytics</h2>
  <table class="facts">
${analytics}
  </table>

  ${body}

  <div class="disclaimer">${escapeHtml(report.disclaimer)}</div>
  <footer>Engine ${escapeHtml(report.engine)} ${escapeHtml(report.engineVersion)} &middot; report ${escapeHtml(report.id)} &middot; version ${report.version}</footer>
</main>
</body>
</html>
`;
}

/* ---------------------------------------------------------------- serialising */

export function serializeReport(report: DetectionReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * The PDF, written here rather than in a component so the same layout function
 * serves the report page, the detector's action bar and the History row.
 */
export function reportPdfBytes(report: DetectionReport): Uint8Array {
  const doc = new PdfDocument({ title: report.title, author: "VeriWrite" });

  doc.text("VERIWRITE - AI DETECTION REPORT", { size: 8, face: "bold", tone: 0.45, leading: 14 });
  doc.text(report.title, { size: 17, face: "bold", leading: 21 });
  doc.text(
    `Generated ${formatDateTime(report.generatedAt)} from an analysis dated ${formatDateTime(
      report.analyzedAt,
    )}.`,
    { size: 8.5, tone: 0.4, leading: 12 },
  );
  doc.space(6);

  doc.heading("Summary");
  report.facts.forEach((item) => {
    doc.row(item.label, item.value, { size: 9.5, face: "regular", valueFace: "bold" });
    doc.text(item.note, { size: 8, tone: 0.45, leading: 10.5, indent: 0 });
  });
  doc.space(6);

  doc.heading("Classification breakdown");
  Object.entries(report.breakdown).forEach(([key, value]) => {
    const percent = Number(value);
    doc.meter(`${CLASSIFICATION_LABEL[key as Classification]}  ${formatPercent(percent)}`, percent, {
      size: 9.5,
    });
  });
  doc.space(6);

  doc.heading("Sentence-level findings");
  doc.text(
    `${report.flaggedCount} of ${report.findings.length} measured sentences crossed the flag line. ` +
      "Sentences at or above the flag line are printed in full; the rest are listed by number and figure.",
    { size: 8.5, tone: 0.4, leading: 11.5 },
  );
  doc.space(4);
  report.findings.forEach((finding) => {
    const lead = `${finding.flagged ? "*" : "-"} ${finding.index + 1}. ${formatPercent(
      finding.aiProbability,
    )} AI - ${CLASSIFICATION_LABEL[finding.classification]}`;
    doc.text(lead, { size: 8.5, face: finding.flagged ? "bold" : "regular", leading: 11 });
    doc.text(finding.text, { size: 9, tone: finding.flagged ? 0 : 0.35, leading: 12, indent: 12 });
  });
  doc.space(6);

  doc.heading("Analytics");
  report.analytics.forEach((metric) => {
    doc.row(metric.label, metric.value, { size: 9.5, valueFace: "bold" });
    doc.text(metric.note, { size: 8, tone: 0.45, leading: 10.5 });
  });
  doc.space(10);

  doc.rule(0.75, 4);
  doc.text(report.disclaimer, { size: 8.5, face: "italic", leading: 11.5 });
  doc.text(`Engine ${report.engine} ${report.engineVersion}. Report ${report.id}, version ${report.version}.`, {
    size: 8,
    tone: 0.45,
    leading: 11,
  });

  return pdfBytes(doc);
}

/**
 * The shareable payload: the report minus its two heaviest parts. The running text
 * goes, because a link should not carry a whole document; the analytics go too,
 * because they are recomputed from the findings a reader can check. The findings
 * themselves stay — sentence text and all — since a report whose sentences were
 * missing would show figures that cannot be read in context.
 */
export function reportSharePayload(report: DetectionReport): string {
  const { analytics: _analytics, text: _text, ...rest } = report;
  return JSON.stringify(rest);
}

export function parseSharePayload(raw: string): { ok: true; report: DetectionReport } | { ok: false; reason: string } {
  const parsed = parseReport(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, report: { ...parsed.report, analytics: buildAnalyticsFromFindings(parsed.report) } };
}

/** Recompute the analytics table from the findings a shared report actually carries. */
function buildAnalyticsFromFindings(report: DetectionReport): AnalyticsMetric[] {
  const words = report.findings.reduce((sum, finding) => sum + finding.words, 0);
  const lengths = report.findings.map((finding) => finding.words);
  const mean = lengths.length > 0 ? words / lengths.length : 0;
  const variance = lengths.length > 0 ? lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length : 0;
  const deviation = Math.sqrt(variance);
  return [
    { label: "Sentences", value: formatNumber(report.findings.length), note: "Carried by the shared report." },
    {
      label: "Average sentence length",
      value: `${mean.toFixed(1)} words`,
      note: "Recomputed from the findings in this file.",
    },
    {
      label: "Sentence-length spread",
      value: deviation.toFixed(1),
      note: "Standard deviation of the sentence word counts.",
    },
    {
      label: "Flagged sentences",
      value: `${formatNumber(report.flaggedCount)} of ${formatNumber(report.findings.length)}`,
      note: "As the engine reported them.",
    },
  ];
}

/** Reads a report file or link payload, rejecting anything that is not one. */
export function parseReport(raw: string): { ok: true; report: DetectionReport } | { ok: false; reason: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "The text is not a report file." };
  }
  const record = value as Partial<DetectionReport> | null;
  if (!record || typeof record !== "object") return { ok: false, reason: "The text is not a report file." };
  if (record.kind !== REPORT_KIND) return { ok: false, reason: "That file came from a different tool." };
  if (record.version !== REPORT_VERSION) {
    return { ok: false, reason: `Report version ${String(record.version)} is not the version this app reads (${REPORT_VERSION}).` };
  }
  if (!Array.isArray(record.findings) || !Array.isArray(record.facts)) {
    return { ok: false, reason: "The report is missing its findings." };
  }
  return { ok: true, report: record as DetectionReport };
}

import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardCopy,
  Download,
  FileText,
  FolderOpen,
  Link2,
  Printer,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/library/ConfirmDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ClassificationBadge, LikelihoodBadge } from "@/components/library/EntryBadges";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { copyReportSummary, downloadReportPdf, printReport } from "@/lib/reportFiles";
import { DETECTION_DISCLAIMER_SHORT, formatDateTime, formatNumber } from "@/lib/utils";
import { isPersisting } from "@/services/documentService";
import {
  clearReports,
  deleteReportRecord,
  getHeldReport,
  listReportableEntries,
  listReports,
  reportFromEntry,
  shareReport,
  type ReportRecord,
} from "@/services/reportService";

interface Row {
  record: ReportRecord;
  /** False when the analysis the report was built from is no longer stored. */
  rebuildable: boolean;
}

/**
 * The reports this device has produced. Only the summary of each run is kept here:
 * the report itself is rebuilt from the analysis row every time it is opened, so a
 * download can never carry figures that differ from the ones History shows.
 */
export function ReportsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tick, setTick] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ReportRecord | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  const snapshot = useMemo(
    () => ({
      records: listReports(),
      reportable: listReportableEntries(),
      held: getHeldReport(),
    }),
    [tick],
  );
  const { records, reportable, held } = snapshot;
  const withResult = new Set(reportable.map((entry) => entry.entryId));

  const rows: Row[] = records.map((record) => ({
    record,
    rebuildable: record.sourceEntryId !== null && withResult.has(record.sourceEntryId),
  }));
  const waiting = reportable.filter((entry) => !entry.hasReport);

  function openRow(record: ReportRecord) {
    if (record.sourceEntryId) {
      navigate(`/report?a=${encodeURIComponent(record.sourceEntryId)}`);
      return;
    }
    toast({
      title: "That report cannot be reopened",
      description: "It was made from a run that was never saved as an analysis, so its detail is not on this device.",
      variant: "error",
    });
  }

  function downloadRow(record: ReportRecord) {
    const source = record.sourceEntryId ? reportFromEntry(record.sourceEntryId) : null;
    if (!source) {
      toast({
        title: "Nothing to download",
        description: "The analysis this report was built from is no longer stored, so the report cannot be recreated.",
        variant: "error",
      });
      return;
    }
    const ok = downloadReportPdf(source.report);
    toast({
      title: ok ? "PDF report saved" : "The download did not start",
      description: ok
        ? "Rebuilt from the saved analysis, so the figures match History."
        : "This browser would not let the page write a file to disk.",
      variant: ok ? "success" : "error",
    });
  }

  async function printRow(record: ReportRecord) {
    const source = record.sourceEntryId ? reportFromEntry(record.sourceEntryId) : null;
    if (!source) {
      toast({
        title: "Nothing to print",
        description: "The analysis this report was built from is no longer stored on this device.",
        variant: "error",
      });
      return;
    }
    const ok = await printReport(source.report);
    toast({
      title: ok ? "Print view opened" : "The print job did not start",
      description: ok
        ? "The browser's print dialog holds the same document the PDF download writes."
        : "This browser refused the print request. Open the report and use its own Print command.",
      variant: ok ? "success" : "error",
    });
  }

  async function copyRow(record: ReportRecord) {
    const source = record.sourceEntryId ? reportFromEntry(record.sourceEntryId) : null;
    if (!source) {
      toast({ title: "No summary to copy", description: "This report cannot be rebuilt.", variant: "error" });
      return;
    }
    const outcome = await copyReportSummary(source.report);
    toast({
      title: outcome === "blocked" ? "The clipboard is not available" : "Summary copied",
      description:
        outcome === "blocked"
          ? "The browser refused clipboard access. Open the report and select the summary there."
          : `${formatNumber(source.report.findings.length)} sentences measured, ${source.report.flaggedCount} flagged.`,
      variant: outcome === "blocked" ? "error" : "success",
    });
  }

  async function shareRow(record: ReportRecord) {
    const source = record.sourceEntryId ? reportFromEntry(record.sourceEntryId) : null;
    if (!source) {
      toast({ title: "No report to share", description: "This report cannot be rebuilt.", variant: "error" });
      return;
    }
    const result = await shareReport(source.report, record, window.location.origin);
    if (!result.ok || !result.url) {
      toast({ title: "No share link", description: result.note, variant: "error" });
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard?.writeText(result.url);
      copied = true;
    } catch {
      copied = false;
    }
    toast({
      title: copied ? "Share link copied" : "Share link ready",
      description: `${result.note}${copied ? "" : ` ${result.url}`}`,
      variant: "success",
    });
    refresh();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const removed = deleteReportRecord(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
    toast({
      title: removed ? "Report removed" : "That report was already gone",
      description: "The analysis it came from stays in History, and the document keeps its text.",
      variant: removed ? "success" : "warning",
    });
  }

  function confirmClear() {
    const count = clearReports();
    setClearOpen(false);
    refresh();
    toast({
      title: count === 0 ? "The report list was already empty" : `${count} report ${count === 1 ? "record" : "records"} removed`,
      description: "No analysis and no document was touched. Reports can be generated again from History.",
      variant: "success",
    });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Every report generated on this device, and the saved analyses that do not have one yet."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Reports" }]}
        actions={
          <>
            <Button asChild variant="subtle" size="sm">
              <Link to="/history">
                <FolderOpen className="size-3.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">History</span>
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/detector">
                <Sparkles className="size-3.5" aria-hidden />
                New run
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {!isPersisting() ? (
          <p className="rounded-lg border border-warning/35 bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-warning">
            Local saving is off in Preferences, so the reports listed here exist only until this tab
            closes. Files you download are unaffected.
          </p>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader title="Generated reports" count={rows.length} />
          {rows.length === 0 ? (
            <CardContent className="p-2">
              <EmptyState
                compact
                icon={FileText}
                title="No reports generated yet"
                description={
                  held
                    ? "A report is open in this tab but has not been filed: use Download Report, Share or Print on it to keep the record."
                    : "Open a saved analysis and use the report actions to produce a PDF, a printable page or a share link."
                }
                action={
                  <Button asChild size="sm">
                    <Link to="/detector">Run an analysis</Link>
                  </Button>
                }
                secondaryAction={
                  waiting.length > 0 ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/history">Report on a saved analysis</Link>
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          ) : (
            <>
              <Table containerClassName="rounded-lg" className="min-w-[52rem]">
                <THead sticky>
                  <TR>
                    {["Report", "Generated", "Words", "AI likelihood", "Classification", "Link", "Actions"].map(
                      (heading) => (
                        <TH key={heading} className={heading === "Actions" ? "text-right" : undefined}>
                          {heading}
                        </TH>
                      ),
                    )}
                  </TR>
                </THead>
                <TBody>
                  {rows.map(({ record, rebuildable }) => (
                    <TR key={record.id}>
                      <TD className="max-w-[18rem] align-top">
                        <p className="truncate text-sm font-medium text-foreground">{record.title}</p>
                        <p className="mt-0.5 text-2xs text-muted-foreground tabular">
                          {rebuildable
                            ? `${formatNumber(record.words)} words, ${record.engine}`
                            : "the analysis behind this report is no longer stored"}
                        </p>
                      </TD>
                      <TD className="whitespace-nowrap align-top text-2xs tabular text-muted-foreground">
                        {formatDateTime(record.createdAt)}
                      </TD>
                      <TD className="align-top tabular">{formatNumber(record.words)}</TD>
                      <TD className="align-top">
                        <LikelihoodBadge value={record.aiProbability} />
                      </TD>
                      <TD className="max-w-[13rem] align-top">
                        <ClassificationBadge value={record.classification} />
                      </TD>
                      <TD className="align-top">
                        {record.shared ? (
                          <Badge variant="info" size="sm" className="max-w-full truncate font-normal">
                            {record.shared.via}
                          </Badge>
                        ) : (
                          <Badge variant="subtle" size="sm">
                            not shared
                          </Badge>
                        )}
                      </TD>
                      <TD className="align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <RowAction
                            label={`Open the report for ${record.title}`}
                            icon={FileText}
                            disabled={!rebuildable}
                            hint="This report was made from a run that was never saved, so its detail is not on this device."
                            onClick={() => openRow(record)}
                          />
                          <RowAction
                            label={`Download the PDF of ${record.title}`}
                            icon={Download}
                            disabled={!rebuildable}
                            hint="The report file cannot be rebuilt without its analysis."
                            onClick={() => downloadRow(record)}
                          />
                          <RowAction
                            label={`Print ${record.title}`}
                            icon={Printer}
                            disabled={!rebuildable}
                            onClick={() => void printRow(record)}
                          />
                          <RowAction
                            label={`Copy the summary of ${record.title}`}
                            icon={ClipboardCopy}
                            disabled={!rebuildable}
                            onClick={() => void copyRow(record)}
                          />
                          <RowAction
                            label={`Share ${record.title}`}
                            icon={Link2}
                            disabled={!rebuildable}
                            onClick={() => void shareRow(record)}
                          />
                          <RowAction
                            label={`Remove ${record.title} from the report list`}
                            icon={Trash2}
                            tone="destructive"
                            onClick={() => setDeleteTarget(record)}
                          />
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  {DETECTION_DISCLAIMER_SHORT}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setClearOpen(true)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Clear report list
                </Button>
              </div>
            </>
          )}
        </Card>

        {waiting.length > 0 ? (
          <Card className="overflow-hidden">
            <CardHeader title="Saved analyses without a report" count={waiting.length} />
            <ul className="divide-y divide-border">
              {waiting.slice(0, 8).map((entry) => (
                <li key={entry.entryId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-[10rem] flex-1">
                    <p className="truncate text-xs font-medium">{entry.title}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground tabular">
                      {formatDateTime(entry.analyzedAt)} · {formatNumber(entry.words)} words ·{" "}
                      {entry.documentExists ? "text stored" : "text no longer stored"}
                    </p>
                  </div>
                  <LikelihoodBadge value={entry.aiProbability} />
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/report?a=${encodeURIComponent(entry.entryId)}`}>
                      <FileText className="size-3.5" aria-hidden />
                      Open report
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            {waiting.length > 8 ? (
              <p className="border-t border-border px-4 py-2.5 text-2xs text-muted-foreground">
                {waiting.length - 8} more saved analyses can be reported from History.
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Remove this report?"
        description={deleteTarget ? `“${deleteTarget.title}” leaves the report list.` : ""}
        confirmLabel="Remove report"
        onConfirm={confirmDelete}
      >
        The saved analysis stays in History and the document keeps its text, so a report can be
        generated again at any time.
      </ConfirmDialog>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear the report list?"
        description={
          records.length === 1
            ? "The one report record on this device will be removed."
            : `All ${records.length} report records on this device will be removed.`
        }
        confirmLabel="Clear list"
        onConfirm={confirmClear}
      >
        Analyses, documents and any report file you already downloaded are untouched.
      </ConfirmDialog>
    </>
  );
}

function CardHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">{title}</h2>
      <p className="text-2xs tabular text-muted-foreground">
        {formatNumber(count)} {count === 1 ? "item" : "items"}
      </p>
    </div>
  );
}

function RowAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  hint,
  tone,
}: {
  label: string;
  icon: typeof FileText;
  onClick(): void;
  disabled?: boolean;
  hint?: string;
  tone?: "destructive";
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      title={disabled && hint ? hint : label}
      aria-label={label}
      className={tone === "destructive" ? "text-error hover:bg-error-soft" : undefined}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}

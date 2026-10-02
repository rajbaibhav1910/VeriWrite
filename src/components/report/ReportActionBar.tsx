import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCopy, Download, FileCode2, FileJson, FileText, Link2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  copyReportSummary,
  downloadReportHtml,
  downloadReportJson,
  downloadReportPdf,
  printReport,
} from "@/lib/reportFiles";
import { isPersisting } from "@/services/documentService";
import {
  holdReport,
  markReportShared,
  saveReportRecord,
  shareReport,
  type ReportSource,
  type ShareResult,
} from "@/services/reportService";

interface ReportActionBarProps {
  source: ReportSource;
  size?: "sm" | "md";
  /** Offer the HTML and JSON exports alongside the PDF. */
  allowOtherFormats?: boolean;
  /** Called after the report list or a record changes, so a page can refresh. */
  onChanged?: () => void;
  className?: string;
}

/**
 * The four report actions from the analysis workspace. Each one does the real thing —
 * writes a file, asks the clipboard, queues a print job or resolves a link — and the
 * message that comes back says what the browser actually did, including when it did
 * nothing at all.
 */
export function ReportActionBar({
  source,
  size = "sm",
  allowOtherFormats = false,
  onChanged,
  className,
}: ReportActionBarProps) {
  const { report, record } = source;
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);

  /**
   * Keep what can be kept: a report tied to a saved analysis becomes a record this
   * device can reopen, and any report is held for the tab so /report can show it. A
   * report from an unsaved run is not filed under Reports — its findings would have
   * nowhere to be rebuilt from.
   */
  function remember() {
    holdReport(source);
    if (record.sourceEntryId) saveReportRecord(record);
    onChanged?.();
  }

  function fileMessage(ok: boolean, format: string) {
    const filing = record.sourceEntryId
      ? isPersisting()
        ? "Listed under Reports on this device."
        : "Listed under Reports for this session only, because local saving is off in Preferences."
      : "Not listed under Reports: the analysis it came from has not been saved, so there would be nothing to rebuild it from.";
    return {
      title: ok ? `${format} report saved` : "The download did not start",
      description: ok
        ? `Written from the measurement made at ${new Date(report.analyzedAt).toLocaleString("en-US")}. ${filing}`
        : "This browser would not let the page write a file to disk.",
      variant: (ok ? "success" : "error") as "success" | "error",
    };
  }

  function downloadPdf() {
    remember();
    toast(fileMessage(downloadReportPdf(report), "PDF"));
  }

  function downloadHtml() {
    remember();
    toast(fileMessage(downloadReportHtml(report), "HTML"));
  }

  function downloadJson() {
    remember();
    toast(fileMessage(downloadReportJson(report), "JSON"));
  }

  async function copySummary() {
    const outcome = await copyReportSummary(report);
    toast({
      title:
        outcome === "clipboard"
          ? "Summary copied"
          : outcome === "selection"
            ? "Summary placed on the clipboard"
            : "The clipboard is not available",
      description:
        outcome === "blocked"
          ? "The browser refused clipboard access. Open the report page and select the summary text there."
          : `${report.findings.length} measured sentences, ${report.flaggedCount} flagged. The disclaimer travels with the figures.`,
      variant: outcome === "blocked" ? "error" : "success",
    });
  }

  async function print() {
    remember();
    const ok = await printReport(report);
    toast({
      title: ok ? "Print view opened" : "The print job did not start",
      description: ok
        ? "The browser's print dialog holds the same document the PDF download writes."
        : "This browser refused the print request. Open the report page and use the browser's own Print command.",
      variant: ok ? "success" : "error",
    });
  }

  async function share() {
    setSharing(true);
    remember();
    try {
      const result: ShareResult = await shareReport(report, record, window.location.origin);
      markReportShared(record.id, result);
      onChanged?.();
      if (!result.ok || !result.url) {
        toast({ title: "No share link", description: result.note, variant: "error" });
        return;
      }
      const copied = await copySummaryToClipboard(result.url);
      toast({
        title: copied ? "Share link copied" : "Share link ready",
        description: `${result.note}${copied ? "" : ` ${result.url}`}`,
        variant: "success",
      });
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className={className} role="group" aria-label="Report actions">
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        <Button type="button" size={size} onClick={downloadPdf}>
          <Download className="size-3.5" aria-hidden />
          Download Report
        </Button>
        <Button type="button" size={size} variant="outline" onClick={() => void share()} loading={sharing}>
          <Link2 className="size-3.5" aria-hidden />
          Share
        </Button>
        <Button type="button" size={size} variant="outline" onClick={() => void copySummary()}>
          <ClipboardCopy className="size-3.5" aria-hidden />
          Copy Summary
        </Button>
        <Button type="button" size={size} variant="outline" onClick={() => void print()}>
          <Printer className="size-3.5" aria-hidden />
          Print
        </Button>
        {allowOtherFormats ? (
          <>
            <Button type="button" size={size} variant="ghost" onClick={downloadHtml}>
              <FileCode2 className="size-3.5" aria-hidden />
              HTML
            </Button>
            <Button type="button" size={size} variant="ghost" onClick={downloadJson}>
              <FileJson className="size-3.5" aria-hidden />
              JSON
            </Button>
          </>
        ) : (
          <Button asChild size={size} variant="ghost">
            <Link to="/report">
              <FileText className="size-3.5" aria-hidden />
              Open report
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

async function copySummaryToClipboard(url: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

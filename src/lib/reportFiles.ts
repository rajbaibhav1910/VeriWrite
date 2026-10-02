import { downloadBlob, downloadTextFile, safeFileName } from "@/lib/download";
import { reportHtml, reportPdfBytes, reportSummaryText, serializeReport, type DetectionReport } from "@/lib/report";

/**
 * Turning a finished report into something the user can hold: a file, a clipboard
 * payload or a print job. Each function answers the honest question of whether the
 * browser actually let it happen — a download that never started is reported as a
 * failure, not as a success message.
 */

export function reportFileName(report: DetectionReport, extension: "pdf" | "html" | "json"): string {
  return `${safeFileName(report.title, "veriwrite")}-report.${extension}`;
}

export function downloadReportPdf(report: DetectionReport): boolean {
  return downloadBlob(reportFileName(report, "pdf"), reportPdfBytes(report), "application/pdf");
}

export function downloadReportHtml(report: DetectionReport): boolean {
  return downloadTextFile(reportFileName(report, "html"), reportHtml(report), "text/html");
}

export function downloadReportJson(report: DetectionReport): boolean {
  return downloadTextFile(reportFileName(report, "json"), serializeReport(report), "application/json");
}

/** Copy the plain-text summary, falling back to a selection the user can copy by hand. */
export async function copyReportSummary(report: DetectionReport): Promise<"clipboard" | "selection" | "blocked"> {
  const text = reportSummaryText(report);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    }
  } catch {
    // Permission denied or an insecure origin: try the selection route below.
  }
  return copyThroughSelection(text) ? "selection" : "blocked";
}

function copyThroughSelection(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

/**
 * Print through the browser using the same standalone HTML the download writes, so
 * the printed page and the saved file are the same document. A print job the browser
 * refuses is reported back rather than assumed to have happened.
 */
export function printReport(report: DetectionReport): Promise<boolean> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(new Blob([reportHtml(report)], { type: "text/html;charset=utf-8" }));
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("title", "Print view");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
      // The job is queued, not completed: give the print dialog time to read the frame.
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 5000);
    };
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        finish(true);
      } catch {
        finish(false);
      }
    };
    frame.onerror = () => finish(false);
    document.body.appendChild(frame);
  });
}

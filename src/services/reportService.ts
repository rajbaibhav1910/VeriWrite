import { apiRequest, backendConfigured } from "@/lib/api";
import { buildReport, parseSharePayload, reportSharePayload, type DetectionReport } from "@/lib/report";
import { readJson, writeJson, remove, STORAGE_KEYS } from "@/lib/storage";
import {
  getAnalysisRecord,
  getDocument,
  isPersisting,
  listHistory,
} from "@/services/documentService";
import type { Classification, ConfidenceLevel, DetectionResult } from "@/types";

/**
 * What this device remembers about a report it produced. The measurement itself is
 * not copied here: a report is rebuilt from the analysis row it came from, so there
 * is only ever one set of figures to keep honest.
 */
export interface ReportRecord {
  id: string;
  createdAt: string;
  title: string;
  analysisId: string;
  /** The history row the report was built from, when there was one. */
  sourceEntryId: string | null;
  documentId: string | null;
  analyzedAt: string;
  words: number;
  aiProbability: number;
  classification: Classification;
  confidence: ConfidenceLevel;
  engine: string;
  shared: { at: string; via: string; url: string } | null;
}

export interface ShareResult {
  ok: boolean;
  url: string | null;
  /** Where the link's content actually comes from, stated in plain words. */
  mode: "report service" | "carried in the link" | "this device only";
  note: string;
}

/** Records are small; a payload carried in a link is not, so links have a budget. */
const MAX_LINK_CHARS = 8_000;

let memoryReports: ReportRecord[] = [];

export function listReports(): ReportRecord[] {
  if (!isPersisting()) return [...memoryReports];
  return readJson<ReportRecord[]>(STORAGE_KEYS.reports, []);
}

function writeReports(records: ReportRecord[]): void {
  if (!isPersisting()) {
    memoryReports = records;
    return;
  }
  writeJson(STORAGE_KEYS.reports, records);
}

export function getReportRecord(id: string): ReportRecord | null {
  return listReports().find((record) => record.id === id) ?? null;
}

export function saveReportRecord(record: ReportRecord): boolean {
  const others = listReports().filter((item) => item.id !== record.id);
  writeReports([record, ...others].slice(0, 200));
  return true;
}

export function markReportShared(id: string, share: ShareResult): ReportRecord | null {
  const record = getReportRecord(id);
  if (!record || !share.ok || !share.url) return record;
  const next: ReportRecord = {
    ...record,
    shared: { at: new Date().toISOString(), via: share.mode, url: share.url },
  };
  writeReports(listReports().map((item) => (item.id === id ? next : item)));
  return next;
}

export function deleteReportRecord(id: string): boolean {
  const before = listReports().length;
  writeReports(listReports().filter((record) => record.id !== id));
  return listReports().length < before;
}

export function clearReports(): number {
  const count = listReports().length;
  if (isPersisting()) remove(STORAGE_KEYS.reports);
  memoryReports = [];
  return count;
}

/* ------------------------------------------------------------- building them */

export interface ReportSource {
  report: DetectionReport;
  record: ReportRecord;
  /** True when the report is tied to a saved analysis row this device can reopen. */
  reopenable: boolean;
}

/** From a finished run that may not be saved yet. */
export function reportFromRun(
  result: DetectionResult,
  options: { title: string; text?: string | null; documentId?: string | null; keepText?: boolean },
): ReportSource {
  const report = buildReport({
    result,
    title: options.title,
    documentId: options.documentId ?? null,
    text: options.keepText === false ? null : options.text ?? null,
  });
  return { report, record: recordFromReport(report, null), reopenable: false };
}

/** From a saved history row, with the document's own text and title. */
export function reportFromEntry(entryId: string): ReportSource | null {
  const found = getAnalysisRecord(entryId);
  if (!found || !found.entry.result) return null;
  const report = buildReport({
    result: found.entry.result,
    title: found.document?.title ?? found.entry.title,
    documentId: found.document?.id ?? found.entry.documentId,
    text: found.document?.text ?? null,
    id: getReportRecordForEntry(entryId)?.id,
    generatedAt: getReportRecordForEntry(entryId)?.createdAt,
  });
  const existing = getReportRecordForEntry(entryId);
  const record = existing ?? recordFromReport(report, entryId);
  return { report, record, reopenable: found.document !== null };
}

function getReportRecordForEntry(entryId: string): ReportRecord | null {
  return listReports().find((record) => record.sourceEntryId === entryId) ?? null;
}

/** Rebuild every reportable row: what History can turn into a report right now. */
export function listReportableEntries() {
  return listHistory()
    .filter((entry) => entry.result !== null)
    .map((entry) => ({
      entryId: entry.id,
      title: entry.title,
      analyzedAt: entry.analyzedAt,
      words: entry.wordCount,
      aiProbability: entry.aiProbability,
      classification: entry.classification,
      confidence: entry.confidence,
      documentExists: getDocument(entry.documentId) !== null,
      hasReport: getReportRecordForEntry(entry.id) !== null,
    }));
}

/**
 * A report generated from a run that was never saved lives only in this tab. The
 * report page reads it from here, which is why it also states where a report came
 * from: reloading a report that was never saved has nothing to rebuild it from.
 */
let openReport: ReportSource | null = null;

export function holdReport(source: ReportSource | null): void {
  openReport = source;
}

export function getHeldReport(): ReportSource | null {
  return openReport;
}

export type ReportVia = "saved analysis" | "carried in the link" | "this tab" | "report service";

export type ReportRoute =
  | { ok: true; source: ReportSource; via: ReportVia }
  | { ok: false; reason: string };

/**
 * Resolve what `/report` shows: the address decides when it names something, and the
 * report this tab last opened is the fallback.
 */
export function resolveReportRoute(params: URLSearchParams, hash: string): ReportRoute {
  const entryId = params.get("a");
  if (entryId) {
    const source = reportFromEntry(entryId);
    return source
      ? { ok: true, source, via: "saved analysis" }
      : { ok: false, reason: "No saved analysis with that id is stored on this device." };
  }

  if (hash.includes("r=")) {
    const carried = reportFromLink(hash);
    if (!carried.ok) return { ok: false, reason: carried.reason };
    const source: ReportSource = {
      report: carried.report,
      record: recordFromReport(carried.report, null),
      reopenable: false,
    };
    holdReport(source);
    return { ok: true, source, via: "carried in the link" };
  }

  if (openReport) return { ok: true, source: openReport, via: "this tab" };

  return {
    ok: false,
    reason: "No report is open. Open one from a finished analysis, from History or from a link.",
  };
}

export function recordFromReport(report: DetectionReport, sourceEntryId: string | null): ReportRecord {
  return {
    id: report.id,
    createdAt: report.generatedAt,
    title: report.title,
    analysisId: report.analysisId,
    sourceEntryId,
    documentId: report.documentId,
    analyzedAt: report.analyzedAt,
    words: report.words,
    aiProbability: report.aiProbability,
    classification: report.classification,
    confidence: report.confidence as ConfidenceLevel,
    engine: `${report.engine} ${report.engineVersion}`,
    shared: null,
  };
}

/* ------------------------------------------------------------------- sharing */

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

interface RemoteReport {
  id?: string;
  url?: string;
  shareUrl?: string;
}

/**
 * Two paths, stated differently to the user. With a backend the report is posted and
 * the service's own link comes back. Without one, nothing leaves the browser: the
 * link either carries the report inside it or reopens the analysis stored on this
 * device, and the copy says which.
 */
export async function shareReport(
  report: DetectionReport,
  record: ReportRecord,
  origin: string,
): Promise<ShareResult> {
  if (backendConfigured()) {
    try {
      const created = await apiRequest<RemoteReport>("/reports", {
        method: "POST",
        body: {
          title: report.title,
          analysisId: report.analysisId,
          documentId: report.documentId,
          analyzedAt: report.analyzedAt,
          aiProbability: report.aiProbability,
          classification: report.classification,
          confidence: report.confidence,
          words: report.words,
          findings: report.findings.length,
          report: JSON.parse(reportSharePayload(report)),
        },
      });
      const url = created.url ?? created.shareUrl ?? (created.id ? `${origin}/report?r=${encodeURIComponent(created.id)}` : null);
      if (!url) {
        return {
          ok: false,
          url: null,
          mode: "report service",
          note: "The report service accepted the upload but returned no link.",
        };
      }
      return {
        ok: true,
        url,
        mode: "report service",
        note: "The report is held by the connected service; anyone with the link can open it.",
      };
    } catch (error) {
      return {
        ok: false,
        url: null,
        mode: "report service",
        note: error instanceof Error ? error.message : "The report service did not answer.",
      };
    }
  }

  if (record.sourceEntryId) {
    const url = `${origin}/report?a=${encodeURIComponent(record.sourceEntryId)}`;
    return {
      ok: true,
      url,
      mode: "this device only",
      note: "No report service is attached, so this link opens the saved analysis in this browser. Nothing was uploaded.",
    };
  }

  const carried = toBase64Url(reportSharePayload(report));
  if (carried.length > MAX_LINK_CHARS) {
    return {
      ok: false,
      url: null,
      mode: "this device only",
      note: `This report is too large to carry inside a link (${Math.round(carried.length / 1000)}k characters). Save the analysis and the link will open the saved row instead.`,
    };
  }
  return {
    ok: true,
    url: `${origin}/report#r=${carried}`,
    mode: "carried in the link",
    note: "No report service is attached, so the report's figures and sentences travel inside the link itself; its full text does not. Nothing was uploaded.",
  };
}

/** Reads the `#r=` token a carried link puts in the address bar. */
export function reportFromLink(hash: string): { ok: true; report: DetectionReport } | { ok: false; reason: string } {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("r");
  if (!token) return { ok: false, reason: "That link does not carry a report." };
  let raw: string;
  try {
    raw = fromBase64Url(token);
  } catch {
    return { ok: false, reason: "The report inside that link is damaged." };
  }
  return parseSharePayload(raw);
}

interface RemoteReportResponse extends RemoteReport {
  report?: unknown;
  payload?: unknown;
}

export interface RemoteReportFetch {
  ok: boolean;
  status: number | null;
  message: string;
  report: DetectionReport | null;
}

/** Only ever called with a backend attached: asks the service for one stored report. */
export async function fetchRemoteReport(id: string): Promise<RemoteReportFetch> {
  try {
    const created = await apiRequest<RemoteReportResponse>(`/reports/${encodeURIComponent(id)}`);
    const raw = created.report ?? created.payload ?? created;
    const parsed = parseSharePayload(JSON.stringify(raw));
    if (!parsed.ok) {
      return {
        ok: false,
        status: 200,
        message: `The report service answered, but ${parsed.reason.toLowerCase()}.`,
        report: null,
      };
    }
    return { ok: true, status: 200, message: "The report service answered.", report: parsed.report };
  } catch (error) {
    return {
      ok: false,
      status:
        error && typeof error === "object" && "status" in error
          ? Number((error as { status?: number }).status)
          : null,
      message: error instanceof Error ? error.message : "The report service did not answer.",
      report: null,
    };
  }
}

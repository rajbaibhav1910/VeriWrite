import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ExternalLink, FileText, History, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportActionBar } from "@/components/report/ReportActionBar";
import { ReportDocument } from "@/components/report/ReportDocument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/loader";
import { backendConfigured } from "@/lib/api";
import { isPersisting } from "@/services/documentService";
import {
  fetchRemoteReport,
  holdReport,
  recordFromReport,
  resolveReportRoute,
  saveReportRecord,
  type ReportSource,
  type ReportVia,
} from "@/services/reportService";

type View =
  | { kind: "loading"; message: string }
  | { kind: "failed"; reason: string }
  | { kind: "report"; source: ReportSource; via: ReportVia };

/**
 * One report, laid out for reading and for printing. Where it came from is always
 * stated: a saved analysis on this device, a report carried inside the link, the
 * connected report service, or the run this tab finished a moment ago.
 */
export function ReportPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const remoteId = searchParams.get("r");
  const [view, setView] = useState<View>(() => start(remoteId, location.search, location.hash));
  const [, setRefresh] = useState(0);

  // The address is the source of truth, so a new link or a back navigation re-resolves.
  useEffect(() => {
    setView(start(remoteId, location.search, location.hash));
  }, [remoteId, location.search, location.hash]);

  // A link that names a stored report asks the service for it. Nothing is invented
  // when no service is attached.
  useEffect(() => {
    if (!remoteId || !backendConfigured()) return;
    let alive = true;
    void fetchRemoteReport(remoteId).then((fetched) => {
      if (!alive) return;
      setView(
        fetched.ok && fetched.report
          ? {
              kind: "report",
              source: { report: fetched.report, record: recordFromReport(fetched.report, null), reopenable: false },
              via: "report service",
            }
          : { kind: "failed", reason: fetched.message },
      );
    });
    return () => {
      alive = false;
    };
  }, [remoteId]);

  // A report opened from a saved analysis is filed as soon as it is shown: that is
  // what makes it appear under Reports with the same figures every time.
  useEffect(() => {
    if (view.kind === "report" && view.via === "saved analysis") {
      holdReport(view.source);
      saveReportRecord(view.source.record);
    }
  }, [view]);

  if (view.kind !== "report") {
    return (
      <>
        <PageHeader
          title="Detection report"
          description="A readable, printable record of one detection run."
          crumbs={[{ to: "/reports", label: "Reports" }, { label: "Report" }]}
        />
        <div className="p-4 sm:p-6">
          <Card className="mx-auto max-w-[46rem]">
            <CardContent className="p-2">
              {view.kind === "loading" ? (
                <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground" role="status">
                  <Spinner size="sm" />
                  {view.message}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No report to show"
                  description={`${view.reason} Reports are made from a finished analysis, so nothing here is measured on the fly.`}
                  action={
                    <Button asChild size="sm">
                      <Link to="/detector">
                        <Sparkles className="size-3.5" aria-hidden />
                        Run an analysis
                      </Link>
                    </Button>
                  }
                  secondaryAction={
                    <Button asChild size="sm" variant="outline">
                      <Link to="/history">
                        <History className="size-3.5" aria-hidden />
                        Open history
                      </Link>
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const { source, via } = view;
  const { report, record } = source;
  const provenance = PROVENANCE[via];

  return (
    <>
      <PageHeader
        title="Detection report"
        description={report.title}
        crumbs={[{ to: "/reports", label: "Reports" }, { label: "Report" }]}
        className="print:hidden"
        actions={
          <>
            {record.sourceEntryId ? (
              <Button asChild variant="subtle" size="sm">
                <Link to={`/detector?analysis=${encodeURIComponent(record.sourceEntryId)}`}>
                  <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only sm:not-sr-only">Open the analysis</span>
                </Link>
              </Button>
            ) : null}
            <ReportActionBar
              source={source}
              allowOtherFormats
              onChanged={() => setRefresh((value) => value + 1)}
            />
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="mx-auto flex max-w-[52rem] flex-wrap items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5 print:hidden">
          <Badge variant={provenance.tone} size="sm">
            {provenance.label}
          </Badge>
          <p className="min-w-[12rem] flex-1 text-2xs leading-relaxed text-muted-foreground">
            {provenance.note}
            {via === "this tab" && !isPersisting()
              ? " Local saving is off in Preferences, so this report exists only until the tab closes."
              : ""}
            {record.shared
              ? ` Last shared ${new Date(record.shared.at).toLocaleString("en-US")}. ${SHARED_LINK[record.shared.via] ?? "That link has not been opened from here."}`
              : ""}
          </p>
        </div>

        <ReportDocument report={report} />
      </div>
    </>
  );
}

/** Read the address: a service id, a saved row, a carried link, or this tab's report. */
function start(remoteId: string | null, search: string, hash: string): View {
  if (remoteId) {
    return backendConfigured()
      ? { kind: "loading", message: "Asking the report service for that report…" }
      : {
          kind: "failed",
          reason:
            "That link names a report held by a report service, and no service is attached to this deployment.",
        };
  }
  const route = resolveReportRoute(new URLSearchParams(search), hash);
  return route.ok
    ? { kind: "report", source: route.source, via: route.via }
    : { kind: "failed", reason: route.reason };
}

const PROVENANCE: Record<ReportVia, { label: string; tone: "info" | "success" | "warning"; note: string }> = {
  "saved analysis": {
    label: "From a saved analysis",
    tone: "success",
    note: "Built from the measurement stored with this analysis on this device, so its figures are the ones that run produced.",
  },
  "carried in the link": {
    label: "Carried in the link",
    tone: "info",
    note: "The link itself held the report's figures and sentences; no service was involved and nothing was uploaded.",
  },
  "this tab": {
    label: "From this tab",
    tone: "warning",
    note: "This report was made from a run that has not been saved as an analysis yet. Save the analysis and the report can be reopened from History.",
  },
  "report service": {
    label: "From the report service",
    tone: "info",
    note: "Returned by the connected report service. Its analytics were recomputed from the findings the service sent back.",
  },
};

/** What each kind of share link can honestly promise about where it opens. */
const SHARED_LINK: Record<string, string> = {
  "this device only": "That link reopens the saved analysis, so it works in this browser on this device.",
  "carried in the link": "That link carries the report's own figures inside it, so it opens anywhere.",
  "report service": "That link asks the connected report service for the stored report.",
};

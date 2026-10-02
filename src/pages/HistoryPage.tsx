import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Database, Eraser, FileClock, History as HistoryIcon, RefreshCw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HistoryTable } from "@/components/library/HistoryTable";
import {
  DEFAULT_HISTORY_FILTERS,
  HistoryFilters,
  type HistoryFilterState,
} from "@/components/library/HistoryFilters";
import { ConfirmDialog } from "@/components/library/ConfirmDialog";
import { RenameDialog } from "@/components/library/RenameDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { DETECTION_DISCLAIMER_SHORT } from "@/lib/utils";
import { downloadTextFile, safeFileName } from "@/lib/download";
import {
  clearHistoryRows,
  copyAnalysis,
  getDocument,
  getLibraryCapabilities,
  isPersisting,
  patchHistory,
  removeHistory,
  serializeAnalysis,
  type HistoryFilter,
  type HistoryPage as HistoryPageResult,
} from "@/services/documentService";
import { useHistoryRows } from "@/hooks/useLibrary";
import { SAMPLE_DOCUMENTS } from "@/data/sampleDocuments";
import { seedDemoData } from "@/data/demoSeed";
import type { HistoryEntry } from "@/types";

const NO_ROWS: HistoryPageResult = {
  entries: [],
  total: 0,
  page: 1,
  pageSize: 12,
  pageCount: 1,
};

export function HistoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filters, setFilters] = useState<HistoryFilterState>(DEFAULT_HISTORY_FILTERS);
  const [page, setPage] = useState(1);
  // Re-reads the stored collection after every write.
  const [revision, setRevision] = useState(0);
  const [renameTarget, setRenameTarget] = useState<HistoryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const capabilities = useMemo(() => getLibraryCapabilities(), [revision]);

  // Built once per change so a service read is not asked again on an unrelated render.
  const query = useMemo<HistoryFilter>(
    () => ({
      query: filters.query,
      classification: filters.classification,
      confidence: filters.confidence,
      from: filters.from || undefined,
      to: filters.to || undefined,
      sort: filters.sort,
      page,
      pageSize: filters.pageSize,
    }),
    [filters, page, revision],
  );

  const rows = useHistoryRows(query);
  const result = rows.page ?? NO_ROWS;

  const totalRows = result.total;

  const patch = useCallback((next: Partial<HistoryFilterState>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }, []);

  const activeCount = [
    filters.query.trim() !== "",
    filters.classification !== "all",
    filters.confidence !== "all",
    filters.from !== "",
    filters.to !== "",
  ].filter(Boolean).length;

  const storing = isPersisting();
  const filtering = activeCount > 0;
  const loading = rows.status === "loading";

  const canOpen = useCallback(
    (entry: HistoryEntry) =>
      entry.result !== null &&
      // Over a service the row itself carries the reference, and opening it reads the
      // text back from the same place; on this device the document has to be present.
      (capabilities.backendConfigured ? entry.documentId !== "" : getDocument(entry.documentId) !== null),
    [capabilities.backendConfigured, revision],
  );

  async function write(label: string, run: () => Promise<unknown>, done: (result: unknown) => void) {
    setBusy(label);
    try {
      const result = await run();
      done(result);
    } catch (error) {
      toast({
        title: "History refused that change",
        description: error instanceof Error ? error.message : "The write did not go through.",
        variant: "error",
      });
    } finally {
      setBusy(null);
      refresh();
    }
  }

  function openEntry(entry: HistoryEntry) {
    navigate(`/detector?analysis=${encodeURIComponent(entry.id)}`);
  }

  function downloadEntry(entry: HistoryEntry) {
    const name = `${safeFileName(entry.title, "analysis")}.json`;
    const ok = downloadTextFile(name, serializeAnalysis(entry), "application/json");
    toast({
      title: ok ? `Saved ${name}` : "The download did not start",
      description: ok
        ? "The engine's full measurement for this run, as JSON. The formatted report is under Report."
        : "This browser would not let the page write a file to disk.",
      variant: ok ? "success" : "error",
    });
  }

  /**
   * A report needs the measurement, so only a row that still carries one can be
   * turned into a document; the engine is never re-run to fill in the gaps.
   */
  function reportEntry(entry: HistoryEntry) {
    if (entry.result === null) {
      toast({
        title: "This row has no measurement",
        description: "Only an analysis whose figures are still stored can become a report.",
        variant: "warning",
      });
      return;
    }
    navigate(`/report?a=${encodeURIComponent(entry.id)}`);
  }

  function duplicateRow(entry: HistoryEntry) {
    void write(
      "duplicate",
      () => copyAnalysis(entry.id),
      (copy) => {
        const done = copy as { entry: HistoryEntry } | null;
        toast({
          title: done ? `Duplicated as “${done.entry.title}”` : "Nothing was duplicated",
          description: done
            ? "A second copy of the text and its measurement, so the original row stays untouched."
            : "The text this row measured is no longer stored, so there is nothing to copy.",
          variant: done ? "success" : "warning",
        });
      },
    );
  }

  function renameRow(title: string) {
    if (!renameTarget) return;
    const target = renameTarget;
    setRenameTarget(null);
    void write("rename", () => patchHistory(target.id, title), () => {
      toast({
        title: "Name updated",
        description: `This analysis row now reads “${title.trim()}”. The document keeps its own name.`,
        variant: "success",
      });
    });
  }

  function deleteRow() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    void write("delete", () => removeHistory(target.id), () => {
      toast({
        title: "Analysis row deleted",
        description: `“${target.title}” is no longer in history. Its document is still in your library.`,
        variant: "success",
      });
    });
  }

  function wipeHistory() {
    // Only an unfiltered count is a promise about how many rows were there.
    const removed = filtering ? null : result.total;
    setClearOpen(false);
    void write("clear", () => clearHistoryRows(), () => {
      toast({
        title: "History cleared",
        description:
          removed === null
            ? "Every saved analysis row was deleted. Your documents were left alone."
            : `${removed} analysis ${removed === 1 ? "row" : "rows"} deleted. Your documents were left alone.`,
        variant: "success",
      });
    });
  }

  async function loadSamples() {
    setSeeding(true);
    const report = await seedDemoData({
      onProgress: (done, total) => {
        if (done === 1 || done === total) {
          toast({
            title: `Preparing samples ${done}/${total}`,
            description: "Each sample document is analysed by the bundled engine, which takes a moment.",
            variant: "info",
            duration: 4_000,
          });
        }
      },
    });
    setSeeding(false);
    refresh();
    toast({
      title: report.skipped ? "Nothing was loaded" : `${report.documentsCreated} documents loaded`,
      description: report.reason,
      variant: report.skipped ? "warning" : "success",
    });
  }

  const rangeLabel =
    result.total === 0
      ? "No rows to show"
      : `Showing ${(result.page - 1) * result.pageSize + 1}–${Math.min(
          result.page * result.pageSize,
          result.total,
        )} of ${result.total}`;

  return (
    <>
      <PageHeader
        title="History"
        description="Every analysis you have saved, with the measurement it produced and the text it was made from."
        crumbs={[{ to: "/documents", label: "Documents" }, { label: "History" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading || busy !== null}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
              Reload
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/detector")}>
              New analysis
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearOpen(true)}
              // With a filter on, the count on screen says nothing about the whole set.
              disabled={(totalRows === 0 && !filtering) || busy !== null}
            >
              <Eraser className="size-3.5" aria-hidden />
              Clear history
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {rows.status === "error" ? (
          <p
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/35 bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground"
          >
            <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden />
            <span className="flex-1">
              The history did not load: {rows.error?.message ?? "the request failed"}.
              {result.entries.length > 0
                ? " The rows below are the last ones read."
                : " There are no rows to show."}
            </span>
            <Button size="sm" variant="outline" onClick={rows.reload}>
              Try again
            </Button>
          </p>
        ) : null}

        {!storing && !capabilities.backendConfigured ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-warning/35 bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground"
          >
            <Database className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
            <span>
              Local saving is turned off in Preferences, so nothing new is written to this device.{" "}
              {totalRows > 0
                ? "The rows below were saved earlier and are still on the device."
                : "History will stay empty until saving is turned back on."}
            </span>
          </p>
        ) : null}

        <p className="text-2xs text-muted-foreground" role="status">
          Rows read from {rows.source}.{loading ? " Reading…" : ""}{busy ? ` ${busy}…` : ""}
        </p>

        <HistoryFilters
          value={filters}
          onChange={patch}
          onClear={() => patch(DEFAULT_HISTORY_FILTERS)}
          activeCount={activeCount}
          resultLabel={`${rangeLabel}${activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? "" : "s"} applied` : ""}`}
        />

        {loading && result.entries.length === 0 ? (
          <Card className="p-4">
            <p role="status" className="text-2xs text-muted-foreground">
              Reading the saved analyses{rows.source === "api service" ? " from the service" : ""}…
            </p>
          </Card>
        ) : totalRows === 0 && !filtering && !loading ? (
          <Card className="p-2">
            <EmptyState
              icon={HistoryIcon}
              title="No saved analyses yet"
              description="Run a detection and choose “Save analysis” to keep the measurement with its text. Saved rows can be reopened, renamed, duplicated and downloaded."
              action={
                <Button size="sm" onClick={() => navigate("/detector")}>
                  Open the detector
                </Button>
              }
              secondaryAction={
                capabilities.backendConfigured ? null : (
                  <Button size="sm" variant="outline" onClick={() => void loadSamples()} loading={seeding}>
                    <Sparkles className="size-3.5" aria-hidden />
                    Load {SAMPLE_DOCUMENTS.length} examples and analyse them
                  </Button>
                )
              }
            />
          </Card>
        ) : filtering && result.entries.length === 0 ? (
          <Card className="p-2">
            <EmptyState
              icon={FileClock}
              compact
              title="No row matches those filters"
              description={`${result.total === 0 ? "Nothing in the saved set" : "Nothing in this page of the saved set"} has that name, classification, confidence or date.`}
              action={
                <Button size="sm" variant="outline" onClick={() => patch(DEFAULT_HISTORY_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <HistoryTable
              entries={result.entries}
              canOpen={canOpen}
              onOpen={openEntry}
              onRename={setRenameTarget}
              onDuplicate={duplicateRow}
              onDownload={downloadEntry}
              onReport={reportEntry}
              onDelete={setDeleteTarget}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-2xs text-muted-foreground tabular">{rangeLabel}</p>
                <p className="text-2xs text-muted-foreground">{DETECTION_DISCLAIMER_SHORT}</p>
              </div>
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                onChange={setPage}
                ariaLabel="Analysis pages"
                showEdges
              />
            </div>
          </>
        )}
      </div>

      <RenameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        subject="analysis"
        initialValue={renameTarget?.title ?? ""}
        hint="Names this saved analysis. The document it points at keeps its own name."
        onSubmit={renameRow}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this analysis?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” and its measurement will be removed from history.`
            : ""
        }
        confirmLabel="Delete analysis"
        onConfirm={deleteRow}
      >
        The document holding the text is not deleted — it stays in your library. Delete it from
        Documents if you want both gone.
      </ConfirmDialog>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all history?"
        description={
          filtering
            ? `Every saved analysis row goes, not only the ${totalRows} the current filters show.`
            : `All ${totalRows} saved analysis ${totalRows === 1 ? "row" : "rows"} will be removed from ${capabilities.backendConfigured ? "the library service" : "this device"}.`
        }
        confirmLabel="Clear history"
        onConfirm={wipeHistory}
      >
        Documents and reports are not touched. This cannot be undone from the app.
      </ConfirmDialog>
    </>
  );
}

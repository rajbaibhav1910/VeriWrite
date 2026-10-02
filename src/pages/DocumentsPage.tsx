import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Database, FolderPlus, FolderOpen, Layers, RefreshCw, Sparkles, Table2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/library/ConfirmDialog";
import { DocumentCards, DocumentTable, type DocumentActions } from "@/components/library/DocumentList";
import { DocumentsRail } from "@/components/library/FolderRail";
import { RenameDialog } from "@/components/library/RenameDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { cn, formatNumber } from "@/lib/utils";
import {
  copyDocument,
  getLibraryCapabilities,
  patchDocument,
  patchFolder,
  putDocument,
  putFolder,
  removeDocument,
  removeFolder,
} from "@/services/documentService";
import { useLibrary } from "@/hooks/useLibrary";
import { SAMPLE_DOCUMENTS } from "@/data/sampleDocuments";
import { seedDemoData } from "@/data/demoSeed";
import type { Folder, StoredDocument } from "@/types";

type ViewMode = "cards" | "table";
/** The rail's pseudo-locations; real folders are addressed by id. */
type Place = "all" | "unfiled" | "favorite";

/** The same matching the local list does, applied to whatever rows the library returned. */
function filterDocuments(rows: StoredDocument[], query: string, place: Place | string) {
  const needle = query.trim().toLowerCase();
  const folderId = place === "all" || place === "favorite" ? undefined : place === "unfiled" ? null : place;
  return rows
    .filter((document) => (folderId === undefined ? true : document.folderId === folderId))
    .filter((document) => (place === "favorite" ? document.favorite : true))
    .filter((document) =>
      needle ? `${document.title} ${document.text}`.toLowerCase().includes(needle) : true,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<Place | string>("all");
  const [view, setView] = useState<ViewMode>("cards");
  const [revision, setRevision] = useState(0);
  const [folderName, setFolderName] = useState("");
  const [renameDoc, setRenameDoc] = useState<StoredDocument | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<StoredDocument | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [seeding, setSeeding] = useState(false);
  // A write that is still in flight; the buttons say so rather than looking idle.
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const capabilities = useMemo(() => getLibraryCapabilities(), [revision]);
  const library = useLibrary(revision);
  const folders = library.folders;
  const everyDocument = library.documents;
  const loading = library.status === "loading";

  const stats = useMemo(
    () => ({
      documents: everyDocument.length,
      wordsStored: everyDocument.reduce((sum, document) => sum + document.wordCount, 0),
      analyses: library.analyses,
      favoriteDocuments: everyDocument.filter((document) => document.favorite).length,
    }),
    [everyDocument, library.analyses],
  );

  const shown = useMemo(() => filterDocuments(everyDocument, query, place), [everyDocument, query, place]);

  const counts = useMemo(() => {
    const perFolder: Record<string, number> = {};
    for (const document of everyDocument) {
      if (document.folderId) perFolder[document.folderId] = (perFolder[document.folderId] ?? 0) + 1;
    }
    return {
      all: everyDocument.length,
      unfiled: everyDocument.filter((document) => !document.folderId).length,
      favorite: everyDocument.filter((document) => document.favorite).length,
      perFolder,
    };
  }, [everyDocument]);

  /**
   * One place for "the library would not take that". A refused write is shown as what it
   * is, because the list on screen may no longer match what the library holds.
   */
  async function write(label: string, run: () => Promise<unknown>, done: (result: unknown) => void) {
    setBusy(label);
    try {
      const result = await run();
      done(result);
    } catch (error) {
      toast({
        title: "The library refused that change",
        description: error instanceof Error ? error.message : "The write did not go through.",
        variant: "error",
      });
    } finally {
      setBusy(null);
      refresh();
    }
  }


  const actions: DocumentActions = {
    onOpen(document) {
      navigate(`/detector?doc=${encodeURIComponent(document.id)}`);
    },
    onRename(document) {
      setRenameDoc(document);
    },
    onDuplicate(document) {
      void write("duplicate", () => copyDocument(document.id), (copy) => {
        const row = copy as StoredDocument | null;
        toast({
          title: row ? `Duplicated as “${row.title}”` : "Nothing was duplicated",
          description: row
            ? "A separate copy with the same text, so the original is untouched."
            : "That document is no longer stored.",
          variant: row ? "success" : "warning",
        });
      });
    },
    onToggleFavorite(document) {
      void write(
        "favourite",
        () => patchDocument(document.id, { favorite: !document.favorite }),
        (updated) => {
          const row = updated as StoredDocument | null;
          toast({
            title: row?.favorite ? "Added to favourites" : "Removed from favourites",
            description: row
              ? `“${row.title}” ${row.favorite ? "is now" : "is no longer"} in your favourites.`
              : undefined,
            variant: "success",
            duration: 2_500,
          });
        },
      );
    },
    onMove(document, folderId) {
      void write("move", () => patchDocument(document.id, { folderId }), (updated) => {
        const row = updated as StoredDocument | null;
        const folder = folders.find((item) => item.id === folderId);
        toast({
          title: row ? "Document moved" : "Nothing was moved",
          description: row
            ? `“${row.title}” now sits in ${folder ? folder.name : "the unfiled list"}.`
            : undefined,
          variant: row ? "success" : "warning",
          duration: 2_500,
        });
      });
    },
    onDelete(document) {
      setDeleteDocTarget(document);
    },
  };

  function commitRename(title: string) {
    if (!renameDoc) return;
    const target = renameDoc;
    setRenameDoc(null);
    void write("rename", () => patchDocument(target.id, { title }), (updated) => {
      const row = updated as StoredDocument | null;
      toast({
        title: row ? "Document renamed" : "That document is gone",
        description: row ? `It now reads “${row.title}”.` : undefined,
        variant: row ? "success" : "warning",
      });
    });
  }

  function commitDelete() {
    if (!deleteDocTarget) return;
    const title = deleteDocTarget.title;
    const target = deleteDocTarget;
    setDeleteDocTarget(null);
    void write("delete", () => removeDocument(target.id), () => {
      toast({
        title: "Document deleted",
        description: `“${title}” and the analysis rows that pointed at it were removed.`,
        variant: "success",
      });
    });
  }

  function addFolder() {
    const name = folderName.trim();
    if (!name) return;
    setFolderName("");
    void write("folder", () => putFolder(name), () => {
      toast({
        title: `Folder “${name}” created`,
        description: "Move a document into it with the folder choice on its card.",
        variant: "success",
      });
    });
  }

  function commitFolderRename(name: string) {
    if (!renameFolderTarget) return;
    const target = renameFolderTarget;
    setRenameFolderTarget(null);
    void write("folder rename", () => patchFolder(target.id, name), () => undefined);
  }

  function commitFolderDelete() {
    if (!deleteFolderTarget) return;
    const name = deleteFolderTarget.name;
    const target = deleteFolderTarget;
    if (place === target.id) setPlace("all");
    setDeleteFolderTarget(null);
    void write("folder delete", () => removeFolder(target.id), () => {
      toast({
        title: `Folder “${name}” deleted`,
        description: "The documents inside were kept and moved back to the unfiled list.",
        variant: "success",
      });
    });
  }

  function newDocument() {
    void write(
      "new document",
      () =>
        putDocument({
          title: "Untitled document",
          tool: "detector",
          folderId: place === "all" || place === "favorite" || place === "unfiled" ? null : place,
        }),
      (created) => {
        const row = created as StoredDocument;
        navigate(`/detector?doc=${encodeURIComponent(row.id)}`);
      },
    );
  }

  async function loadSamples() {
    setSeeding(true);
    const report = await seedDemoData({});
    setSeeding(false);
    refresh();
    toast({
      title: report.skipped ? "Nothing was loaded" : `${report.documentsCreated} documents loaded`,
      description: report.reason,
      variant: report.skipped ? "warning" : "success",
    });
  }

  return (
    <>
      <PageHeader
        title="My Documents"
        description="Your saved writing, the folders it sits in, and the analyses attached to it. Opening a document loads it into the editor, where it keeps autosaving."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Documents" }]}
        actions={
          <>
            <Button size="sm" onClick={newDocument} disabled={busy !== null || loading}>
              <FolderPlus className="size-3.5" aria-hidden />
              New document
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={busy !== null || loading}
              aria-label="Reload the library"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
              Reload
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
              History
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <Card className="p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                addFolder();
              }}
              className="space-y-1.5"
            >
              <Label htmlFor="new-folder" className="text-2xs uppercase tracking-wider">
                New folder
              </Label>
              <div className="flex gap-1.5">
                <Input
                  id="new-folder"
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  placeholder="Coursework, drafts, client…"
                  maxLength={60}
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="md"
                  variant="outline"
                  disabled={folderName.trim().length === 0 || busy !== null}
                >
                  Add
                </Button>
              </div>
            </form>
          </Card>

          <DocumentsRail
            folders={folders}
            counts={counts}
            place={place}
            onSelect={setPlace}
            onRenameFolder={setRenameFolderTarget}
            onDeleteFolder={setDeleteFolderTarget}
          />

          <Card className="p-3">
            <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {capabilities.backendConfigured ? "The library service" : "This device"}
            </h2>
            <dl className="mt-2 space-y-1.5 text-2xs">
              <Stat label="Documents" value={formatNumber(stats.documents)} />
              <Stat label="Words stored" value={formatNumber(stats.wordsStored)} />
              <Stat label="Analyses saved" value={formatNumber(stats.analyses)} />
              <Stat label="Favourites" value={formatNumber(stats.favoriteDocuments)} />
            </dl>
            <p className="mt-2 flex items-start gap-1.5 border-t border-border pt-2 text-2xs leading-relaxed text-muted-foreground">
              <Database className="mt-px size-3 shrink-0" aria-hidden />
              {capabilities.note}
            </p>
            {library.unreadable > 0 ? (
              <p className="mt-2 flex items-start gap-1.5 text-2xs leading-relaxed text-warning">
                <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
                {formatNumber(library.unreadable)} row{library.unreadable === 1 ? "" : "s"} the service
                sent could not be read by this build, so they are not listed above.
              </p>
            ) : null}
          </Card>
        </div>

        <div className="min-w-0 space-y-3">
          {library.status === "error" ? (
            <p
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/35 bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground"
            >
              <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden />
              <span className="flex-1">
                The library service did not answer: {library.error?.message ?? "the request failed"}.{" "}
                {everyDocument.length > 0
                  ? "The rows below are the last ones it sent and may be out of date."
                  : "Nothing was listed because no rows arrived."}
              </span>
              <Button size="sm" variant="outline" onClick={refresh}>
                Try again
              </Button>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[12rem] flex-1">
              <Label htmlFor="document-search" className="sr-only">
                Search documents
              </Label>
              <Input
                id="document-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles and text"
                autoComplete="off"
              />
            </div>
            <SegmentedControl
              label="View"
              size="sm"
              value={view}
              onChange={(next) => setView(next)}
              options={[
                { value: "cards", label: "Cards", icon: <Layers aria-hidden className="size-3.5" /> },
                { value: "table", label: "Table", icon: <Table2 aria-hidden className="size-3.5" /> },
              ]}
            />
          </div>

          <p className="text-2xs text-muted-foreground" role="status">
            {formatNumber(shown.length)} of {formatNumber(everyDocument.length)} documents shown
            {query.trim() ? ` · “${query.trim()}”` : ""}
            {loading ? " · reading the library" : ""}
            {busy ? ` · ${busy}` : ""}
          </p>

          {everyDocument.length === 0 && !loading ? (
            <Card className="p-2">
              <EmptyState
                icon={FolderOpen}
                title="No saved documents yet"
                description="A document holds your text and the analyses made from it. New documents open straight into the editor and keep autosaving as you type."
                action={
                  <Button size="sm" onClick={newDocument}>
                    New document
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
          ) : view === "table" ? (
            <DocumentTable documents={shown} folders={folders} emptyLabel="No document matches that search." {...actions} />
          ) : (
            <DocumentCards documents={shown} folders={folders} emptyLabel="No document matches that search." {...actions} />
          )}
        </div>
      </div>

      <RenameDialog
        open={renameDoc !== null}
        onOpenChange={(open) => {
          if (!open) setRenameDoc(null);
        }}
        subject="document"
        initialValue={renameDoc?.title ?? ""}
        onSubmit={commitRename}
      />

      <RenameDialog
        open={renameFolderTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameFolderTarget(null);
        }}
        subject="folder"
        initialValue={renameFolderTarget?.name ?? ""}
        hint="Documents filed here stay filed; only the folder's name changes."
        onSubmit={commitFolderRename}
      />

      <ConfirmDialog
        open={deleteDocTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDocTarget(null);
        }}
        title="Delete this document?"
        description={
          deleteDocTarget
            ? `“${deleteDocTarget.title}” will be removed from ${capabilities.backendConfigured ? "the library service" : "this device"}.`
            : ""
        }
        confirmLabel="Delete document"
        onConfirm={commitDelete}
      >
        The analysis rows saved from this document are deleted with it. This cannot be undone from
        the app.
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteFolderTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteFolderTarget(null);
        }}
        title="Delete this folder?"
        description={
          deleteFolderTarget
            ? `“${deleteFolderTarget.name}” goes, along with ${counts.perFolder[deleteFolderTarget.id] ?? 0} filing${(counts.perFolder[deleteFolderTarget.id] ?? 0) === 1 ? "" : "s"}.`
            : ""
        }
        confirmLabel="Delete folder"
        onConfirm={commitFolderDelete}
      >
        No document is deleted by this. Everything filed in the folder moves back to the unfiled
        list.
      </ConfirmDialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular font-medium text-foreground")}>{value}</dd>
    </div>
  );
}

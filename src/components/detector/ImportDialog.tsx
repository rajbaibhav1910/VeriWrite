import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { formatRelativeTime, formatNumber } from "@/lib/utils";
import { backendConfigured } from "@/lib/api";
import { getLibraryCapabilities, listDocuments, loadDocuments } from "@/services/documentService";
import type { StoredDocument } from "@/types";

interface ImportDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onPick(document: StoredDocument): void;
}

/**
 * Reads the document library through the same service the workspace uses, so an
 * empty list means genuinely empty rather than a placeholder screen. The trigger
 * lives in the editor toolbar, so this dialog is controlled by the page.
 */
export function ImportDialog({ open, onOpenChange, onPick }: ImportDialogProps) {
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!backendConfigured()) {
      setDocuments(listDocuments());
      setReading(false);
      setReadError(null);
      return;
    }
    // A service read cannot happen during the render, so the list arrives a moment later.
    let active = true;
    setReading(true);
    setReadError(null);
    void (async () => {
      try {
        const rows = await loadDocuments();
        if (active) setDocuments(rows);
      } catch (error) {
        if (active) {
          setDocuments([]);
          setReadError(error instanceof Error ? error.message : "The library did not answer.");
        }
      } finally {
        if (active) setReading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const where = getLibraryCapabilities();
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? documents.filter((document) =>
          `${document.title} ${document.text}`.toLowerCase().includes(needle))
      : documents;
  }, [documents, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import a saved document</DialogTitle>
          <DialogDescription>
            Loads the document text into the editor. Your current text stays in the undo
            history, so this is reversible.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="p-0">
          <div className="border-b border-border p-4">
            <label className="sr-only" htmlFor="import-search">
              Search saved documents
            </label>
            <Input
              id="import-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved documents"
              autoComplete="off"
            />
          </div>

          {readError ? (
            <p
              role="status"
              className="border-b border-border bg-surface-sunken px-5 py-2.5 text-2xs leading-relaxed text-muted-foreground"
            >
              The library did not answer: {readError}
            </p>
          ) : null}

          {reading ? (
            <p
              role="status"
              className="border-b border-border px-5 py-3 text-2xs text-muted-foreground"
            >
              Reading the saved documents…
            </p>
          ) : null}

          {documents.length === 0 && !reading ? (
            <EmptyState
              icon={FolderOpen}
              title="No saved documents yet"
              description="Documents you create or upload in the workspace appear here. Text pasted in the editor is not saved until you store it."
              action={
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Back to the editor
                </Button>
              }
            />
          ) : matches.length === 0 ? (
            <EmptyState
              compact
              icon={FileText}
              title={`Nothing matches "${query.trim()}"`}
              description={`${formatNumber(documents.length)} saved document${documents.length === 1 ? "" : "s"} ${where.backendConfigured ? "on the library service" : "in this browser"}.`}
            />
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => {
                      onPick(entry);
                      onOpenChange(false);
                    }}
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{entry.title}</span>
                      <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
                        {formatNumber(entry.wordCount)} words · edited{" "}
                        {formatRelativeTime(entry.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

import { Copy, ExternalLink, FolderInput, PencilLine, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/library/EntryBadges";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";
import { truncate } from "@/lib/text";
import { TOOL_NAME } from "@/config/navigation";
import type { Folder, StoredDocument } from "@/types";

export interface DocumentActions {
  onOpen(document: StoredDocument): void;
  onRename(document: StoredDocument): void;
  onDuplicate(document: StoredDocument): void;
  onToggleFavorite(document: StoredDocument): void;
  onMove(document: StoredDocument, folderId: string | null): void;
  onDelete(document: StoredDocument): void;
}

interface ListProps extends DocumentActions {
  documents: StoredDocument[];
  folders: Folder[];
  emptyLabel: string;
}

interface RowProps {
  document: StoredDocument;
  folders: Folder[];
  actions: DocumentActions;
}

const HEADINGS = ["Document", "Last edited", "Words", "Tool used", "Status", "Actions"];

function FolderChoice({ document, folders, actions }: RowProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
      <FolderInput className="size-3 shrink-0" aria-hidden />
      <label className="sr-only" htmlFor={`${document.id}-folder`}>
        Folder for {document.title}
      </label>
      <Select
        id={`${document.id}-folder`}
        className="h-7 min-w-[6.5rem] flex-1 text-2xs"
        value={document.folderId ?? ""}
        onChange={(event) => actions.onMove(document, event.target.value || null)}
      >
        <option value="">Unfiled</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function FavoriteToggle({ document, actions }: RowProps) {
  const favorite = document.favorite;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={favorite ? `Remove ${document.title} from favourites` : `Favourite ${document.title}`}
      aria-pressed={favorite}
      title={favorite ? "In favourites" : "Add to favourites"}
      onClick={() => actions.onToggleFavorite(document)}
      className={cn(favorite && "text-warning")}
    >
      <Star aria-hidden fill={favorite ? "currentColor" : "none"} />
    </Button>
  );
}

function RowTools({ document, actions }: RowProps) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Open ${document.title} in the editor`}
        title="Open in the editor"
        onClick={() => actions.onOpen(document)}
      >
        <ExternalLink aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Rename ${document.title}`}
        title="Rename"
        onClick={() => actions.onRename(document)}
      >
        <PencilLine aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Duplicate ${document.title}`}
        title="Duplicate"
        onClick={() => actions.onDuplicate(document)}
      >
        <Copy aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${document.title}`}
        title="Delete"
        className="text-muted-foreground hover:bg-error-soft hover:text-error"
        onClick={() => actions.onDelete(document)}
      >
        <Trash2 aria-hidden />
      </Button>
    </>
  );
}

function Meta({ document }: { document: StoredDocument }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" size="sm">
        {TOOL_NAME[document.tool]}
      </Badge>
      <StatusBadge value={document.status} />
    </div>
  );
}

export function DocumentTable({ documents, folders, emptyLabel, ...actions }: ListProps) {
  return (
    <Table containerClassName="rounded-lg border border-border" className="min-w-[52rem]">
      <THead sticky>
        <TR>
          {HEADINGS.map((heading) => (
            <TH key={heading}>{heading}</TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {documents.map((document) => (
          <TR key={document.id}>
            <TD className="max-w-[22rem] align-top">
              <div className="flex items-start gap-1">
                <FavoriteToggle document={document} folders={folders} actions={actions} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{document.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
                    {document.text.trim() ? truncate(document.text, 120) : "Empty document."}
                  </p>
                  <div className="mt-1.5 max-w-[15rem]">
                    <FolderChoice document={document} folders={folders} actions={actions} />
                  </div>
                </div>
              </div>
            </TD>
            <TD className="whitespace-nowrap align-top text-2xs tabular text-muted-foreground">
              {formatRelativeTime(document.updatedAt)}
            </TD>
            <TD className="align-top tabular">{formatNumber(document.wordCount)}</TD>
            <TD className="align-top">
              <Badge variant="outline" size="sm">
                {TOOL_NAME[document.tool]}
              </Badge>
            </TD>
            <TD className="align-top">
              <StatusBadge value={document.status} />
            </TD>
            <TD className="align-top">
              <div className="flex items-center gap-0.5">
                <RowTools document={document} folders={folders} actions={actions} />
              </div>
            </TD>
          </TR>
        ))}
        {documents.length === 0 ? (
          <TR>
            <TD colSpan={HEADINGS.length} className="py-10 text-center text-2xs text-muted-foreground">
              {emptyLabel}
            </TD>
          </TR>
        ) : null}
      </TBody>
    </Table>
  );
}

export function DocumentCards({ documents, folders, emptyLabel, ...actions }: ListProps) {
  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-2xs text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((document) => {
        const folder = folders.find((item) => item.id === document.folderId);
        return (
          <li
            key={document.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{document.title}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  Edited {formatRelativeTime(document.updatedAt)}
                </p>
              </div>
              <FavoriteToggle document={document} folders={folders} actions={actions} />
            </div>

            <p className="line-clamp-3 min-h-[2.75rem] text-2xs leading-relaxed text-muted-foreground">
              {document.text.trim() ? truncate(document.text, 180) : "Empty document."}
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="subtle" size="sm" className="tabular">
                {formatNumber(document.wordCount)} words
              </Badge>
              <Meta document={document} />
              {folder ? (
                <Badge variant="outline" size="sm" className="max-w-[9rem] truncate">
                  {folder.name}
                </Badge>
              ) : null}
            </div>

            <div className="mt-auto space-y-2 border-t border-border pt-2.5">
              <FolderChoice document={document} folders={folders} actions={actions} />
              <div className="flex items-center gap-0.5">
                <RowTools document={document} folders={folders} actions={actions} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { FileText, Folder, FolderOpen, PencilLine, Star, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";
import type { Folder as FolderType } from "@/types";

export interface FolderCounts {
  all: number;
  unfiled: number;
  favorite: number;
  perFolder: Record<string, number>;
}

interface FolderRailProps {
  folders: FolderType[];
  counts: FolderCounts;
  /** `"all"`, `"unfiled"`, `"favorite"`, or a folder id. */
  place: string;
  onSelect(place: string): void;
  onRenameFolder(folder: FolderType): void;
  onDeleteFolder(folder: FolderType): void;
}

const PLACES: { place: string; label: string; icon: typeof FileText }[] = [
  { place: "all", label: "All documents", icon: FileText },
  { place: "favorite", label: "Favourites", icon: Star },
  { place: "unfiled", label: "Unfiled", icon: FolderOpen },
];

/** The filing choices on the left of the library: saved sets, favourites, folders. */
export function DocumentsRail({
  folders,
  counts,
  place,
  onSelect,
  onRenameFolder,
  onDeleteFolder,
}: FolderRailProps) {
  return (
    <nav
      aria-label="Document locations"
      className="rounded-lg border border-border bg-card p-1.5 shadow-card"
    >
      <ul className="space-y-0.5">
        {PLACES.map((item) => {
          const count =
            item.place === "all"
              ? counts.all
              : item.place === "favorite"
                ? counts.favorite
                : counts.unfiled;
          return (
            <PlaceRow
              key={item.place}
              id={item.place}
              label={item.label}
              count={count}
              icon={<item.icon aria-hidden />}
              selected={place === item.place}
              onSelect={onSelect}
            />
          );
        })}
      </ul>

      <p className="mt-2 px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Folders
      </p>
      {folders.length === 0 ? (
        <p className="px-2 pb-2 text-2xs leading-relaxed text-muted-foreground">
          No folders yet. Add one above, then move a document into it with the folder choice on that
          document.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {folders.map((folder) => (
            <PlaceRow
              key={folder.id}
              id={folder.id}
              label={folder.name}
              count={counts.perFolder[folder.id] ?? 0}
              icon={<Folder aria-hidden />}
              selected={place === folder.id}
              onSelect={onSelect}
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Rename folder ${folder.name}`}
                    onClick={() => onRenameFolder(folder)}
                  >
                    <PencilLine aria-hidden className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-muted-foreground opacity-0 transition-opacity hover:bg-error-soft hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete folder ${folder.name}`}
                    onClick={() => onDeleteFolder(folder)}
                  >
                    <Trash2 aria-hidden className="size-3" />
                  </Button>
                </>
              }
            />
          ))}
        </ul>
      )}
    </nav>
  );
}

function PlaceRow({
  id,
  label,
  count,
  icon,
  selected,
  onSelect,
  actions,
}: {
  id: string;
  label: string;
  count: number;
  icon: ReactNode;
  selected: boolean;
  onSelect(place: string): void;
  actions?: ReactNode;
}) {
  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "bg-primary-soft font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <span className="[&_svg]:size-3.5">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {actions ? <span className="flex items-center">{actions}</span> : null}
      <span className="shrink-0 pr-1 text-2xs tabular text-muted-foreground">
        {formatNumber(count)}
      </span>
    </li>
  );
}

import { Copy, Download, FileClock, FileText, PencilLine, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClassificationBadge, ConfidenceBadge, LikelihoodBadge, StatusBadge } from "@/components/library/EntryBadges";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { TOOL_NAME } from "@/config/navigation";
import type { HistoryEntry } from "@/types";

export interface HistoryRowActions {
  onOpen(entry: HistoryEntry): void;
  onRename(entry: HistoryEntry): void;
  onDuplicate(entry: HistoryEntry): void;
  onDownload(entry: HistoryEntry): void;
  /** Open the printable/shareable report built from this row. */
  onReport(entry: HistoryEntry): void;
  onDelete(entry: HistoryEntry): void;
  /** Whether the text this row measured is still stored and can be reopened. */
  canOpen(entry: HistoryEntry): boolean;
}

interface HistoryTableProps extends HistoryRowActions {
  entries: HistoryEntry[];
}

const HEADINGS = [
  "Document",
  "Analysed",
  "Words",
  "AI likelihood",
  "Classification",
  "Confidence",
  "Status",
  "Actions",
];

export function HistoryTable({
  entries,
  onOpen,
  onRename,
  onDuplicate,
  onDownload,
  onReport,
  onDelete,
  canOpen,
}: HistoryTableProps) {
  return (
    <Table containerClassName="rounded-lg border border-border" className="min-w-[58rem]">
      <THead sticky>
        <TR>
          {HEADINGS.map((heading) => (
            <TH key={heading} className={heading === "Actions" ? "text-right" : undefined}>
              {heading}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {entries.map((entry) => (
          <TR key={entry.id}>
            <TD className="max-w-[18rem] align-top">
              <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
                <Badge variant="outline" size="xs">
                  {TOOL_NAME[entry.tool]}
                </Badge>
                <span className="truncate">
                  {entry.result
                    ? `${formatNumber(entry.result.sentences.length)} sentences measured`
                    : "no measurement stored for this row"}
                </span>
              </p>
            </TD>
            <TD className="whitespace-nowrap align-top text-2xs tabular text-muted-foreground">
              {formatDateTime(entry.analyzedAt)}
            </TD>
            <TD className="align-top tabular">{formatNumber(entry.wordCount)}</TD>
            <TD className="align-top">
              <LikelihoodBadge value={entry.aiProbability} />
            </TD>
            <TD className="max-w-[13rem] align-top">
              <ClassificationBadge value={entry.classification} />
            </TD>
            <TD className="align-top">
              <ConfidenceBadge value={entry.confidence} />
            </TD>
            <TD className="align-top">
              <StatusBadge value={entry.status} />
            </TD>
            <TD className="align-top">
              <div className="flex items-center justify-end gap-0.5">
                <RowAction
                  label={`Open ${entry.title}`}
                  icon={ExternalLink}
                  disabled={!canOpen(entry)}
                  hint="The stored text for this row is gone, so it cannot be reopened."
                  onClick={() => onOpen(entry)}
                />
                <RowAction label={`Rename ${entry.title}`} icon={PencilLine} onClick={() => onRename(entry)} />
                <RowAction label={`Duplicate ${entry.title}`} icon={Copy} onClick={() => onDuplicate(entry)} />
                <RowAction label={`Download ${entry.title}`} icon={Download} onClick={() => onDownload(entry)} />
                <RowAction
                  label={`Open the report for ${entry.title}`}
                  icon={FileText}
                  disabled={entry.result === null}
                  hint="This row has no stored measurement, so there is nothing to report."
                  onClick={() => onReport(entry)}
                />
                <RowAction
                  label={`Delete ${entry.title}`}
                  icon={Trash2}
                  tone="destructive"
                  onClick={() => onDelete(entry)}
                />
              </div>
            </TD>
          </TR>
        ))}
        {entries.length === 0 ? (
          <TR>
            <TD colSpan={HEADINGS.length} className="py-10 text-center text-2xs text-muted-foreground">
              <FileClock className="mx-auto mb-2 size-4" aria-hidden />
              No analysis row matches the filters above.
            </TD>
          </TR>
        ) : null}
      </TBody>
    </Table>
  );
}

function RowAction({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  tone = "default",
  hint,
}: {
  label: string;
  icon: typeof Copy;
  onClick(): void;
  disabled?: boolean;
  tone?: "default" | "destructive";
  hint?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={hint ?? label}
      disabled={disabled}
      onClick={onClick}
      className={tone === "destructive" ? "text-muted-foreground hover:bg-error-soft hover:text-error" : undefined}
    >
      <Icon aria-hidden />
    </Button>
  );
}

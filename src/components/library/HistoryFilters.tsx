import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CLASSIFICATION_LABEL, CONFIDENCE_LABEL } from "@/lib/utils";
import type { HistorySort } from "@/services/documentService";
import type { Classification, ConfidenceLevel } from "@/types";

export interface HistoryFilterState {
  query: string;
  classification: Classification | "all";
  confidence: ConfidenceLevel | "all";
  /** Empty strings mean "no bound"; the input type is `date`. */
  from: string;
  to: string;
  sort: HistorySort;
  pageSize: number;
}

interface HistoryFiltersProps {
  value: HistoryFilterState;
  onChange(patch: Partial<HistoryFilterState>): void;
  onClear(): void;
  /** How many filters are actually narrowing the list right now. */
  activeCount: number;
  resultLabel: string;
}

const CLASSIFICATIONS = Object.keys(CLASSIFICATION_LABEL) as Classification[];
const CONFIDENCES = Object.keys(CONFIDENCE_LABEL) as ConfidenceLevel[];

const SORT_LABEL: Record<HistorySort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "highest-ai": "Highest AI likelihood",
  "lowest-ai": "Lowest AI likelihood",
  longest: "Longest text",
};

const fieldClass = "space-y-1 min-w-0";
const labelClass = "block text-2xs font-medium uppercase tracking-wider text-muted-foreground";

/** Search, the three spec filters, sorting and page size for the history list. */
export function HistoryFilters({
  value,
  onChange,
  onClear,
  activeCount,
  resultLabel,
}: HistoryFiltersProps) {
  return (
    <section
      aria-label="Filter analyses"
      className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card"
    >
      <div className={fieldClass}>
        <Label htmlFor="history-query" className={labelClass}>
          Search
        </Label>
        <Input
          id="history-query"
          type="search"
          value={value.query}
          onChange={(event) => onChange({ query: event.target.value })}
          placeholder="Document name or tool"
          autoComplete="off"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={fieldClass}>
          <Label htmlFor="history-classification" className={labelClass}>
            Classification
          </Label>
          <Select
            id="history-classification"
            value={value.classification}
            onChange={(event) => onChange({ classification: event.target.value as Classification | "all" })}
          >
            <option value="all">Any classification</option>
            {CLASSIFICATIONS.map((item) => (
              <option key={item} value={item}>
                {CLASSIFICATION_LABEL[item]}
              </option>
            ))}
          </Select>
        </div>

        <div className={fieldClass}>
          <Label htmlFor="history-confidence" className={labelClass}>
            Confidence
          </Label>
          <Select
            id="history-confidence"
            value={value.confidence}
            onChange={(event) => onChange({ confidence: event.target.value as ConfidenceLevel | "all" })}
          >
            <option value="all">Any confidence</option>
            {CONFIDENCES.map((item) => (
              <option key={item} value={item}>
                {CONFIDENCE_LABEL[item]}
              </option>
            ))}
          </Select>
        </div>

        <div className={fieldClass}>
          <Label htmlFor="history-sort" className={labelClass}>
            Sort by
          </Label>
          <Select
            id="history-sort"
            value={value.sort}
            onChange={(event) => onChange({ sort: event.target.value as HistorySort })}
          >
            {(Object.keys(SORT_LABEL) as HistorySort[]).map((item) => (
              <option key={item} value={item}>
                {SORT_LABEL[item]}
              </option>
            ))}
          </Select>
        </div>

        <div className={fieldClass}>
          <Label htmlFor="history-page-size" className={labelClass}>
            Rows per page
          </Label>
          <Select
            id="history-page-size"
            value={String(value.pageSize)}
            onChange={(event) => onChange({ pageSize: Number(event.target.value) })}
          >
            {[10, 12, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <Label htmlFor="history-from" className={labelClass}>
            From date
          </Label>
          <Input
            id="history-from"
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(event) => onChange({ from: event.target.value })}
          />
        </div>
        <div className={fieldClass}>
          <Label htmlFor="history-to" className={labelClass}>
            To date
          </Label>
          <Input
            id="history-to"
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-2xs text-muted-foreground" role="status">
          {resultLabel}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={activeCount === 0}
        >
          Clear filters
          {activeCount > 0 ? (
            <span className="tabular text-foreground">({activeCount})</span>
          ) : null}
        </Button>
      </div>
    </section>
  );
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  query: "",
  classification: "all",
  confidence: "all",
  from: "",
  to: "",
  sort: "newest",
  pageSize: 12,
};

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
  ariaLabel?: string;
  showEdges?: boolean;
}

function buildPages(page: number, pageCount: number, siblingCount: number) {
  const pages = new Set<number>([1, pageCount]);
  for (let candidate = page - siblingCount; candidate <= page + siblingCount; candidate += 1) {
    if (candidate >= 1 && candidate <= pageCount) pages.add(candidate);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous > 0 && value - previous > 1) out.push("gap");
    out.push(value);
    previous = value;
  }
  return out;
}

const pageButtonClass =
  "inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40";

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(function Pagination(
  {
    page,
    pageCount,
    onChange,
    siblingCount = 1,
    className,
    ariaLabel = "Pagination",
    showEdges = false,
  },
  ref,
) {
  const safePageCount = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), safePageCount);
  const pages = buildPages(current, safePageCount, siblingCount);

  const go = (next: number) => {
    if (next < 1 || next > safePageCount || next === current) return;
    onChange(next);
  };

  return (
    <nav ref={ref} aria-label={ariaLabel} className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        className={cn(pageButtonClass, "hover:bg-muted")}
        onClick={() => go(current - 1)}
        disabled={current <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden />
      </button>
      {showEdges && current > 2 ? (
        <button
          type="button"
          className={cn(pageButtonClass, "hover:bg-muted")}
          onClick={() => go(1)}
          aria-label="First page"
        >
          1
        </button>
      ) : null}
      <ul className="flex items-center gap-1">
        {pages.map((value, index) =>
          value === "gap" ? (
            <li key={`gap-${index}`} aria-hidden className="inline-flex size-8 items-center justify-center text-muted-foreground">
              <MoreHorizontal className="size-4" />
            </li>
          ) : (
            <li key={value}>
              <button
                type="button"
                className={cn(
                  pageButtonClass,
                  value === current
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => go(value)}
                aria-current={value === current ? "page" : undefined}
                aria-label={`Page ${value}`}
              >
                {value}
              </button>
            </li>
          ),
        )}
      </ul>
      {showEdges && current < safePageCount - 1 ? (
        <button
          type="button"
          className={cn(pageButtonClass, "hover:bg-muted")}
          onClick={() => go(safePageCount)}
          aria-label="Last page"
        >
          {safePageCount}
        </button>
      ) : null}
      <button
        type="button"
        className={cn(pageButtonClass, "hover:bg-muted")}
        onClick={() => go(current + 1)}
        disabled={current >= safePageCount}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden />
      </button>
    </nav>
  );
});
Pagination.displayName = "Pagination";

export { Pagination };

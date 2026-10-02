import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  to?: string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  crumbs?: Crumb[];
  /** Compact keeps tool pages dense; roomy is for library/marketing pages. */
  density?: "compact" | "roomy";
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  density = "compact",
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border md:flex-row md:items-end md:justify-between",
        density === "compact" ? "px-4 py-4 sm:px-6" : "px-4 py-8 sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-2xs text-muted-foreground">
              {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight className="size-3" aria-hidden="true" />
                  )}
                  {crumb.to ? (
                    <Link to={crumb.to} className="transition-colors hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-foreground">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1
          className={cn(
            "font-semibold tracking-tight text-foreground",
            density === "compact" ? "text-lg" : "text-2xl sm:text-3xl",
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              "mt-1 max-w-[62ch] text-muted-foreground",
              density === "compact" ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps
  extends Omit<React.ComponentPropsWithRef<"div">, "title"> {
  /** Either a rendered element (<Search />) or a component type (Search). */
  icon?: React.ReactNode | React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action, usually a <Button>. */
  action?: React.ReactNode;
  /** Secondary action rendered as a link-styled button slot. */
  secondaryAction?: React.ReactNode;
  compact?: boolean;
}

function EmptyStateIcon({ icon, compact }: { icon: EmptyStateProps["icon"]; compact: boolean }) {
  if (!icon) return null;
  const content =
    React.isValidElement(icon) || typeof icon === "string"
      ? icon
      : React.createElement(icon as React.ElementType);
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-lg border border-border bg-surface-sunken text-muted-foreground [&_svg]:size-5",
        compact ? "size-9 [&_svg]:size-4" : "size-11",
      )}
    >
      {content}
    </div>
  );
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { className, icon, title, description, action, secondaryAction, compact = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
      {...props}
    >
      <EmptyStateIcon icon={icon} compact={compact} />
      <div className="flex flex-col gap-1">
        <p className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              "max-w-md text-balance leading-relaxed text-muted-foreground",
              compact ? "text-2xs" : "text-sm",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
});
EmptyState.displayName = "EmptyState";

export { EmptyState };

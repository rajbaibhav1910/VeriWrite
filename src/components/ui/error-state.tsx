import * as React from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import type { ServiceError } from "@/types";

export interface ErrorStateProps
  extends Omit<React.ComponentPropsWithRef<"div">, "title"> {
  error?: ServiceError | null;
  /** Overrides the copy derived from `error`; never leave both out. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

const FALLBACK_TITLE = "Something went wrong";
const FALLBACK_DESCRIPTION = "We could not complete this action. Please try again.";

const ERROR_TITLE: Record<ServiceError["code"], string> = {
  text_too_short: "Not enough text to analyse",
  text_too_long: "That text is too long",
  invalid_file: "We could not read that file",
  unsupported_file: "That file type is not supported",
  unsupported_language: "That language is not covered here",
  network: "Connection problem",
  api: "The service returned an error",
  auth: "You do not have access to that",
  timeout: "That analysis took too long",
  rate_limited: "Usage limit reached",
  unknown: FALLBACK_TITLE,
};

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(function ErrorState(
  { className, error, title, description, onRetry, retryLabel = "Try again", action, compact = false, ...props },
  ref,
) {
  const resolvedTitle = title ?? (error ? ERROR_TITLE[error.code] : FALLBACK_TITLE);
  const resolvedDescription =
    description ?? error?.message ?? FALLBACK_DESCRIPTION;

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-lg border border-error/25 bg-error-soft text-error [&_svg]:size-5",
          compact ? "size-9 [&_svg]:size-4" : "size-11",
        )}
      >
        <TriangleAlert />
      </div>
      <div className="flex flex-col gap-1">
        <p className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>
          {resolvedTitle}
        </p>
        <p
          className={cn(
            "max-w-md text-balance leading-relaxed text-muted-foreground",
            compact ? "text-2xs" : "text-sm",
          )}
        >
          {resolvedDescription}
        </p>
        {error?.hint ? (
          <p className="max-w-md text-2xs leading-relaxed text-muted-foreground">{error.hint}</p>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button type="button" variant="default" size="md" onClick={onRetry}>
            <RotateCcw aria-hidden />
            {retryLabel}
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
});
ErrorState.displayName = "ErrorState";

export { ErrorState };

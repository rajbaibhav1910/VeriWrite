import * as React from "react";
import { Check, LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin text-current", {
  variants: {
    size: {
      xs: "size-3",
      sm: "size-3.5",
      md: "size-4",
      lg: "size-6",
      xl: "size-8",
    },
  },
  defaultVariants: { size: "md" },
});

export interface SpinnerProps
  extends React.ComponentPropsWithRef<"span">,
    VariantProps<typeof spinnerVariants> {
  /** Announced to screen readers; omit when a visible label already exists. */
  label?: string;
}

const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { className, size, label, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-label={label}
      className={cn("inline-flex shrink-0", className)}
      {...props}
    >
      <LoaderCircle className={cn(spinnerVariants({ size }))} aria-hidden />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
});
Spinner.displayName = "Spinner";

export interface LoadingBarProps extends React.ComponentPropsWithRef<"div"> {
  label?: string;
  /** Track height; keeps the bar usable inline in toolbars. */
  thickness?: "thin" | "regular";
}

const LoadingBar = React.forwardRef<HTMLDivElement, LoadingBarProps>(function LoadingBar(
  { className, label = "Loading", thickness = "regular", ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        thickness === "thin" ? "h-0.5" : "h-1",
        className,
      )}
      {...props}
    >
      {/* The token shimmer reads as indeterminate progress without new keyframes. */}
      <div className="skeleton h-full w-full rounded-full" />
    </div>
  );
});
LoadingBar.displayName = "LoadingBar";

export interface StepLoaderStep {
  label: string;
  description?: string;
}

export interface StepLoaderProps extends React.ComponentPropsWithRef<"div"> {
  steps: readonly (string | StepLoaderStep)[];
  /** Zero-based index of the phase in progress; earlier phases render as done. */
  current: number;
  done?: boolean;
  showIndex?: boolean;
}

function normaliseSteps(steps: readonly (string | StepLoaderStep)[]): StepLoaderStep[] {
  return steps.map((step) => (typeof step === "string" ? { label: step } : step));
}

const StepLoader = React.forwardRef<HTMLDivElement, StepLoaderProps>(function StepLoader(
  { className, steps, current, done = false, showIndex = false, ...props },
  ref,
) {
  const items = normaliseSteps(steps);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    >
      {items.map((step, index) => {
        const isDone = done || index < current;
        const isActive = !done && index === current;
        return (
          <div
            key={`${step.label}-${index}`}
            data-state={isDone ? "done" : isActive ? "active" : "upcoming"}
            className={cn(
              "relative flex items-start gap-3 rounded-md px-2 py-1.5",
              isActive && "bg-muted/60",
            )}
          >
            {index > 0 ? (
              <span
                aria-hidden
                className="absolute left-[1.0625rem] -top-1 h-2.5 w-px bg-border"
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-2xs",
                isDone
                  ? "border-transparent bg-success-soft text-success"
                  : isActive
                    ? "border-primary/40 bg-primary-soft text-primary"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              {isDone ? (
                <Check className="size-3" />
              ) : isActive ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : showIndex ? (
                index + 1
              ) : null}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-sm leading-snug",
                  isDone ? "text-muted-foreground" : "text-foreground",
                  isActive && "font-medium",
                )}
              >
                {step.label}
              </span>
              {step.description && (isActive || isDone) ? (
                <span className="text-2xs leading-snug text-muted-foreground">
                  {step.description}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
});
StepLoader.displayName = "StepLoader";

export { Spinner, LoadingBar, StepLoader, spinnerVariants };

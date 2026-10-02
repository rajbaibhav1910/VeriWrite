import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Lets the detector tint the fill per signal without touching the track. */
  indicatorClassName?: string;
  indicator?: React.ReactNode;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { className, value, indicatorClassName, indicator, ...props },
  ref,
) {
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 rounded-full bg-primary transition-transform duration-500 ease-out",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      >
        {indicator}
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = "Progress";

export { Progress };

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  trackClassName?: string;
  thumbClassName?: string;
}

const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  { className, trackClassName, thumbClassName, "aria-label": ariaLabel, ...props },
  ref,
) {
  const thumbs = props.value?.length ?? props.defaultValue?.length ?? 1;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2 outline-none",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range
          className={cn("absolute h-full bg-primary", trackClassName)}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbs }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          // Radix puts role="slider" on the thumbs, so a label on the root would be dropped.
          aria-label={
            ariaLabel === undefined || thumbs === 1
              ? ariaLabel
              : `${ariaLabel} (${index + 1} of ${thumbs})`
          }
          className={cn(
            "block size-4 rounded-full border border-border bg-card shadow-raised transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing disabled:opacity-50",
            thumbClassName,
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = "Slider";

export { Slider };

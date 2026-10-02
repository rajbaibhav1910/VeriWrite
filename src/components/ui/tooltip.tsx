import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 240,
  skipDelayDuration = 300,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}
TooltipProvider.displayName = "TooltipProvider";

// Includes its own provider so a single tooltip works without app-level setup.
function Tooltip(props: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root {...props} />
    </TooltipProvider>
  );
}
Tooltip.displayName = "Tooltip";

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(function TooltipTrigger({ className, ...props }, ref) {
  return <TooltipPrimitive.Trigger ref={ref} className={cn(className)} {...props} />;
});
TooltipTrigger.displayName = "TooltipTrigger";

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  /** Roomier padding + wider measure for multi-paragraph explanations. */
  rich?: boolean;
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  function TooltipContent({ className, sideOffset = 6, rich = false, children, ...props }, ref) {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            "z-50 max-w-xs rounded-md border border-border bg-popover text-popover-foreground shadow-overlay outline-none data-[state=closed]:animate-[popover-out_110ms_ease-in] data-[state=delayed-open]:animate-[popover-in_140ms_ease-out] data-[state=instant-open]:animate-[popover-in_140ms_ease-out]",
            rich ? "w-72 max-w-[calc(100vw-2rem)] p-3.5 text-sm leading-relaxed" : "px-2.5 py-1.5 text-2xs leading-snug",
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="fill-popover" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    );
  },
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent };

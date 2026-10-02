import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
Popover.displayName = "Popover";

const PopoverTrigger = PopoverPrimitive.Trigger;
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverAnchor = PopoverPrimitive.Anchor;
PopoverAnchor.displayName = "PopoverAnchor";

const PopoverClose = PopoverPrimitive.Close;
PopoverClose.displayName = "PopoverClose";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(
  { className, align = "start", sideOffset = 8, collisionPadding = 12, ...props },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-overlay outline-none data-[state=closed]:animate-[popover-out_110ms_ease-in] data-[state=open]:animate-[popover-in_150ms_ease-out]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent };

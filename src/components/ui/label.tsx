import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithRef<"label">>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn(
          "flex select-none items-center gap-1.5 text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";

export { Label };

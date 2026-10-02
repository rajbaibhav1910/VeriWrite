import * as React from "react";
import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function Skeleton({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading content"
        className={cn("skeleton rounded-md", className)}
        {...props}
      />
    );
  },
);
Skeleton.displayName = "Skeleton";

export { Skeleton };

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithRef<"input">>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-card outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/40 read-only:bg-surface-sunken",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

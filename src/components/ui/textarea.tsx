import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentPropsWithRef<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-20 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-card outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/40 read-only:bg-surface-sunken",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.ComponentPropsWithRef<"select"> {
  wrapperClassName?: string;
}

// Native on purpose: keyboard, mobile and form semantics come free.
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, wrapperClassName, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          "h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-md border border-input bg-card pl-3 pr-9 text-sm text-foreground shadow-card outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
});
Select.displayName = "Select";

export { Select };

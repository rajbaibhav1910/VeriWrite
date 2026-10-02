import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm font-medium tracking-tight transition-colors [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary-soft text-secondary-foreground",
        outline: "border border-border bg-card text-muted-foreground",
        subtle: "bg-muted text-muted-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        error: "bg-error-soft text-error",
        info: "bg-info-soft text-info",
        "signal-ai": "bg-signal-ai-bg text-signal-ai ring-1 ring-inset ring-signal-ai-line",
        "signal-human": "bg-signal-human-bg text-signal-human ring-1 ring-inset ring-signal-human-line",
        "signal-mixed": "bg-signal-mixed-bg text-signal-mixed ring-1 ring-inset ring-signal-mixed-line",
        "signal-neutral": "bg-signal-neutral-bg text-signal-neutral ring-1 ring-inset ring-signal-neutral-line",
      },
      size: {
        xs: "h-4.5 gap-1 px-1.5 text-2xs [&_svg]:size-3",
        sm: "h-5 gap-1 px-2 text-2xs [&_svg]:size-3",
        md: "h-6 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "sm" },
  },
);

export interface BadgeProps
  extends React.ComponentPropsWithRef<"span">,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, size, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
});

Badge.displayName = "Badge";

export { Badge, badgeVariants };

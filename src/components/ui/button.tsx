import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-primary/90",
        secondary: "bg-secondary-soft text-secondary-foreground hover:bg-secondary-soft/70",
        outline: "border border-border bg-card text-foreground shadow-card hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        subtle: "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
        destructive: "bg-error text-primary-foreground shadow-card hover:bg-error/90",
        link: "text-primary underline-offset-4 hover:underline active:translate-y-0",
      },
      size: {
        sm: "h-8 gap-1.5 px-3 text-2xs",
        md: "h-9 px-3.5",
        lg: "h-10 gap-2.5 px-4 text-[0.9375rem]",
        xl: "h-11 gap-2.5 px-5 text-base",
        // A touch pointer gets the 44px target that a 36px square does not.
        icon: "size-9 pointer-coarse:size-11",
        "icon-sm": "size-8 pointer-coarse:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentPropsWithRef<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

// Icons are passed as the first child; the base layer sizes and shrinks them.
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
  ref,
) {
  const Comp: React.ElementType = asChild ? Slot : "button";
  const isDisabled = disabled || loading;

  return (
    <Comp
      ref={ref}
      className={cn(
        buttonVariants({ variant, size }),
        // link has no box of its own: it inherits the size slot but hugs the text.
        variant === "link" && "h-auto justify-start rounded-xs px-0",
        className,
      )}
      disabled={asChild ? undefined : isDisabled || undefined}
      aria-busy={loading || undefined}
      // Without an explicit type, a button inside a <form> silently submits it.
      type={asChild ? undefined : "button"}
      {...props}
    >
      {children === undefined ? (
        loading ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : null
      ) : (
        <>
          <span
            className={cn(
              "inline-flex items-center justify-center gap-2",
              loading && "invisible",
            )}
          >
            {children}
          </span>
          {loading ? (
            <Loader2
              className="absolute inset-0 m-auto size-4 animate-spin"
              aria-hidden
            />
          ) : null}
        </>
      )}
    </Comp>
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };

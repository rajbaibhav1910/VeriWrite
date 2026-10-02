import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:bg-muted hover:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-card",
        outline:
          "border border-border bg-card text-muted-foreground shadow-card hover:bg-muted hover:text-foreground data-[state=on]:bg-primary-soft data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-inset data-[state=on]:ring-primary/25",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
      },
      size: {
        sm: "h-7 gap-1 rounded-sm px-2 text-2xs",
        md: "h-9 px-3 text-sm",
        lg: "h-10 px-4 text-[0.9375rem]",
        icon: "size-8",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ToggleProps
  extends Omit<React.ComponentPropsWithRef<"button">, "onChange" | "defaultValue">,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { className, variant, size, pressed, defaultPressed = false, onPressedChange, onClick, ...props },
  ref,
) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultPressed);
  const isControlled = pressed !== undefined;
  const state = isControlled ? pressed : uncontrolled;

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={state}
      data-state={state ? "on" : "off"}
      className={cn(toggleVariants({ variant, size }), className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!isControlled) setUncontrolled((current) => !current);
        onPressedChange?.(!state);
      }}
      {...props}
    />
  );
});
Toggle.displayName = "Toggle";

export { Toggle, toggleVariants };

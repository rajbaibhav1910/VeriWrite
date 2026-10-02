import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const switchRootVariants = cva(
  "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
  {
    variants: {
      size: {
        sm: "h-4.5 w-8",
        md: "h-5 w-9",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const switchThumbVariants = cva(
  "pointer-events-none block rounded-full bg-card shadow-raised ring-0 transition-transform data-[state=unchecked]:translate-x-0",
  {
    variants: {
      size: {
        sm: "size-3.5 data-[state=checked]:translate-x-3.5",
        md: "size-4 data-[state=checked]:translate-x-4",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type SwitchRootProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> &
  VariantProps<typeof switchRootVariants>;

const SwitchRoot = React.forwardRef<HTMLButtonElement, SwitchRootProps>(function SwitchRoot(
  { className, size, ...props },
  ref,
) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(switchRootVariants({ size }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className={cn(switchThumbVariants({ size }))} />
    </SwitchPrimitive.Root>
  );
});
SwitchRoot.displayName = "SwitchRoot";

export interface SwitchProps extends SwitchRootProps {
  /** Renders a wired <label> next to the switch; use htmlFor/Label for custom layouts. */
  label?: React.ReactNode;
  labelClassName?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, labelClassName, id, ...props },
  ref,
) {
  const autoId = React.useId();
  const switchId = id ?? autoId;
  const control = <SwitchRoot ref={ref} id={switchId} {...props} />;

  if (!label) return control;

  return (
    <span className="inline-flex items-center gap-2.5">
      {control}
      <label
        htmlFor={switchId}
        className={cn(
          "cursor-pointer select-none text-sm text-foreground peer-disabled:opacity-60",
          labelClassName,
        )}
      >
        {label}
      </label>
    </span>
  );
});
Switch.displayName = "Switch";

export { Switch, SwitchRoot, switchRootVariants, switchThumbVariants };

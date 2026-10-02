import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const segmentedControlVariants = cva(
  "inline-flex items-center gap-1 rounded-md border border-border bg-surface-sunken p-1",
  {
    variants: {
      size: { sm: "h-8", md: "h-9" },
      stretched: { true: "w-full", false: "w-fit" },
    },
    defaultVariants: { size: "md", stretched: false },
  },
);

const segmentVariants = cva(
  "relative inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      size: { sm: "px-2.5 py-1 text-2xs", md: "px-3 py-1 text-sm" },
      selected: {
        true: "bg-card text-foreground shadow-card",
        false: "text-muted-foreground hover:text-foreground",
      },
      stretched: { true: "flex-1", false: "" },
    },
    defaultVariants: { size: "md", selected: false, stretched: false },
  },
);

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string>
  extends Omit<React.ComponentPropsWithRef<"div">, "onChange" | "defaultValue"> {
  options: readonly SegmentedControlOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Announced as the group name, e.g. "Filter results". */
  label: string;
  size?: "sm" | "md";
  stretched?: boolean;
}

function enabledIndices<T extends string>(options: readonly SegmentedControlOption<T>[]) {
  return options.reduce<number[]>((acc, option, index) => {
    if (!option.disabled) acc.push(index);
    return acc;
  }, []);
}

function SegmentedControlRender<T extends string = string>(
  {
    options,
    value,
    onChange,
    label,
    size = "md",
    stretched = false,
    className,
    ...props
  }: SegmentedControlProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = enabledIndices(options);
  const selectedIndex = options.findIndex((option) => option.value === value);

  const activate = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    buttons.current[index]?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const step = (direction: 1 | -1) => {
    if (enabled.length === 0) return;
    const position = enabled.indexOf(selectedIndex);
    const nextPosition =
      position === -1
        ? direction === 1
          ? 0
          : enabled.length - 1
        : (position + direction + enabled.length) % enabled.length;
    activate(enabled[nextPosition]);
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className={cn(segmentedControlVariants({ size, stretched }), className)}
      onKeyDown={(event) => {
        switch (event.key) {
          case "ArrowRight":
          case "ArrowDown":
            event.preventDefault();
            step(1);
            break;
          case "ArrowLeft":
          case "ArrowUp":
            event.preventDefault();
            step(-1);
            break;
          case "Home":
            event.preventDefault();
            activate(enabled[0]);
            break;
          case "End":
            event.preventDefault();
            activate(enabled[enabled.length - 1]);
            break;
          default:
            break;
        }
      }}
      {...props}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            tabIndex={selected || (value === null && index === 0) ? 0 : -1}
            className={cn(segmentVariants({ size, selected, stretched }))}
            onClick={() => activate(index)}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
            {option.count !== undefined ? (
              <span className="tabular rounded-sm bg-muted px-1 text-2xs text-muted-foreground">
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type SegmentedControlElement = (<T extends string = string>(
  props: SegmentedControlProps<T> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement) & { displayName?: string };

// Cast keeps the generic parameter reachable through forwardRef.
const SegmentedControl = React.forwardRef(
  SegmentedControlRender,
) as unknown as SegmentedControlElement;
SegmentedControl.displayName = "SegmentedControl";

export { SegmentedControl, segmentedControlVariants, segmentVariants };

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
Sheet.displayName = "Sheet";

const SheetTrigger = DialogPrimitive.Trigger;
SheetTrigger.displayName = "SheetTrigger";

const SheetClose = DialogPrimitive.Close;
SheetClose.displayName = "SheetClose";

const SheetPortal = DialogPrimitive.Portal;
SheetPortal.displayName = "SheetPortal";

const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-surface-sunken/70 backdrop-blur-[2px] data-[state=closed]:animate-[overlay-out_150ms_ease-in] data-[state=open]:animate-[overlay-in_180ms_ease-out]",
        className,
      )}
      {...props}
    />
  );
});
SheetOverlay.displayName = "SheetOverlay";

const sheetContentVariants = cva(
  "fixed z-50 flex flex-col border-border bg-card text-card-foreground shadow-overlay outline-none data-[state=closed]:animate-[sheet-out_200ms_ease-in] data-[state=open]:animate-[sheet-in_260ms_cubic-bezier(0.22,1,0.36,1)]",
  {
    variants: {
      side: {
        left: "inset-y-0 left-0 h-full w-72 max-w-[85vw] [--sheet-x:-100%] border-r",
        right: "inset-y-0 right-0 h-full w-96 max-w-[92vw] [--sheet-x:100%] border-l",
        top: "inset-x-0 top-0 max-h-[85svh] w-full [--sheet-y:-100%] rounded-b-xl border-b",
        bottom:
          "inset-x-0 bottom-0 max-h-[85svh] w-full [--sheet-y:100%] rounded-t-xl border-t",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetContentVariants> {
  showClose?: boolean;
  /** Drag handle bar; defaults to true for top and bottom sheets. */
  handle?: boolean;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(function SheetContent(
  { className, children, side = "right", showClose = true, handle, ...props },
  ref,
) {
  const showHandle = handle ?? (side === "bottom" || side === "top");

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          sheetContentVariants({ side }),
          side === "bottom" && "pb-[env(safe-area-inset-bottom)]",
          className,
        )}
        {...props}
      >
        {showHandle ? (
          <div
            className={cn(
              "flex shrink-0 justify-center py-2",
              side === "top" && "order-last",
            )}
            aria-hidden
          >
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
        ) : null}
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label="Close panel"
            className="absolute right-3 top-3 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:size-4"
          >
            <X aria-hidden />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function SheetHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex shrink-0 flex-col gap-1 border-b border-border p-5 pr-12 text-left", className)}
        {...props}
      />
    );
  },
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function SheetFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex shrink-0 flex-col gap-2 border-t border-border p-5 sm:flex-row sm:justify-end",
          className,
        )}
        {...props}
      />
    );
  },
);
SheetFooter.displayName = "SheetFooter";

const SheetBody = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function SheetBody({ className, ...props }, ref) {
    return (
      <div ref={ref} className={cn("min-h-0 flex-1 overflow-y-auto p-5", className)} {...props} />
    );
  },
);
SheetBody.displayName = "SheetBody";

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
});
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetBody,
  SheetTitle,
  SheetDescription,
  sheetContentVariants,
};

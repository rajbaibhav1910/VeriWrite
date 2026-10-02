import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
Dialog.displayName = "Dialog";

const DialogTrigger = DialogPrimitive.Trigger;
DialogTrigger.displayName = "DialogTrigger";

const DialogPortal = DialogPrimitive.Portal;
DialogPortal.displayName = "DialogPortal";

const DialogClose = DialogPrimitive.Close;
DialogClose.displayName = "DialogClose";

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
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
DialogOverlay.displayName = "DialogOverlay";

const dialogContentVariants = cva(
  // inset + m-auto centring keeps the transform free for enter/exit animation.
  "fixed inset-0 z-50 m-auto flex max-h-[calc(100svh-2rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-overlay outline-none data-[state=closed]:animate-[popover-out_130ms_ease-in] data-[state=open]:animate-[popover-in_180ms_cubic-bezier(0.22,1,0.36,1)]",
  {
    variants: {
      size: {
        sm: "h-fit max-w-sm",
        md: "h-fit max-w-lg",
        lg: "h-fit max-w-2xl",
        xl: "h-fit max-w-4xl",
        full: "h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  showClose?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { className, children, size = "md", showClose = true, ...props },
  ref,
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(dialogContentVariants({ size }), className)} {...props}>
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="absolute right-3.5 top-3.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:size-4"
          >
            <X aria-hidden />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function DialogHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1.5 border-b border-border p-5 pr-14 text-left", className)}
        {...props}
      />
    );
  },
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function DialogFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end",
          className,
        )}
        {...props}
      />
    );
  },
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-base font-semibold leading-snug tracking-tight", className)}
      {...props}
    />
  );
});
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
});
DialogDescription.displayName = "DialogDescription";

const DialogBody = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function DialogBody({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex-1 overflow-y-auto p-5", className)} {...props} />;
  },
);
DialogBody.displayName = "DialogBody";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogBody,
  dialogContentVariants,
};

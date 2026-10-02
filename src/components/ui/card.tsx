import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-lg border border-border bg-card text-card-foreground shadow-card",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1.5 p-5", className)}
        {...props}
      />
    );
  },
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithRef<"h3">>(
  function CardTitle({ className, children, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn("text-sm font-semibold leading-snug tracking-tight", className)}
        {...props}
      >
        {children}
      </h3>
    );
  },
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithRef<"p">
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
});
CardDescription.displayName = "CardDescription";

const CardAction = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function CardAction({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-action"
        className={cn(
          "absolute right-4 top-4 flex items-center gap-1.5",
          className,
        )}
        {...props}
      />
    );
  },
);
CardAction.displayName = "CardAction";

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />;
  },
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithRef<"div">>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 border-t border-border px-5 py-4",
          className,
        )}
        {...props}
      />
    );
  },
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };

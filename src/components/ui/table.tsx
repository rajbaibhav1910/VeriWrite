import * as React from "react";
import { cn } from "@/lib/utils";

export interface TableProps extends React.ComponentPropsWithRef<"table"> {
  containerClassName?: string;
}

// Scroll container lives here so a sticky THead has something to stick to.
const Table = React.forwardRef<HTMLTableElement, TableProps>(function Table(
  { className, containerClassName, ...props },
  ref,
) {
  return (
    <div className={cn("relative w-full overflow-auto", containerClassName)}>
      <table
        ref={ref}
        className={cn("w-full caption-bottom border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
});
Table.displayName = "Table";

export interface THeadProps extends React.ComponentPropsWithRef<"thead"> {
  sticky?: boolean;
}

const THead = React.forwardRef<HTMLTableSectionElement, THeadProps>(function THead(
  { className, sticky = false, ...props },
  ref,
) {
  return (
    <thead
      ref={ref}
      className={cn(
        "border-b border-border bg-surface-sunken [&_th]:bg-surface-sunken",
        sticky && "[&_th]:sticky [&_th]:top-0 [&_th]:z-10",
        className,
      )}
      {...props}
    />
  );
});
THead.displayName = "THead";

const TBody = React.forwardRef<HTMLTableSectionElement, React.ComponentPropsWithRef<"tbody">>(
  function TBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={cn(className)} {...props} />;
  },
);
TBody.displayName = "TBody";

const TFoot = React.forwardRef<HTMLTableSectionElement, React.ComponentPropsWithRef<"tfoot">>(
  function TFoot({ className, ...props }, ref) {
    return (
      <tfoot
        ref={ref}
        className={cn("border-t border-border bg-surface text-foreground", className)}
        {...props}
      />
    );
  },
);
TFoot.displayName = "TFoot";

const TR = React.forwardRef<HTMLTableRowElement, React.ComponentPropsWithRef<"tr">>(function TR(
  { className, ...props },
  ref,
) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50 data-[state=selected]:bg-primary-soft",
        className,
      )}
      {...props}
    />
  );
});
TR.displayName = "TR";

const TH = React.forwardRef<HTMLTableCellElement, React.ComponentPropsWithRef<"th">>(function TH(
  { className, ...props },
  ref,
) {
  return (
    <th
      ref={ref}
      scope="col"
      className={cn(
        "h-9 px-3 text-left align-middle text-2xs font-semibold uppercase tracking-wider text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
});
TH.displayName = "TH";

const TD = React.forwardRef<HTMLTableCellElement, React.ComponentPropsWithRef<"td">>(function TD(
  { className, ...props },
  ref,
) {
  return (
    <td
      ref={ref}
      className={cn("px-3 py-2.5 align-middle [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
});
TD.displayName = "TD";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.ComponentPropsWithRef<"caption">
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      className={cn("mt-3 text-left text-2xs text-muted-foreground", className)}
      {...props}
    />
  );
});
TableCaption.displayName = "TableCaption";

export {
  Table,
  THead,
  TBody,
  TFoot,
  TR,
  TH,
  TD,
  TableCaption,
  THead as TableHeader,
  TBody as TableBody,
  TFoot as TableFooter,
  TR as TableRow,
  TH as TableHead,
  TD as TableCell,
};

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type TabsListVariant = "segment" | "underlined";

const Tabs = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(function Tabs({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Root
      ref={ref}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
});
Tabs.displayName = "Tabs";

const tabsListVariants = cva("inline-flex items-center outline-none", {
  variants: {
    variant: {
      segment: "gap-1 self-start rounded-md border border-border bg-surface-sunken p-1",
      underlined: "w-full gap-6 border-b border-border",
    },
    size: {
      sm: "text-2xs",
      md: "text-sm",
    },
  },
  defaultVariants: { variant: "segment", size: "md" },
});

const TabsListContext = React.createContext<{ variant: TabsListVariant } | null>(null);

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { className, variant = "segment", size, ...props },
  ref,
) {
  return (
    <TabsListContext.Provider value={{ variant: variant ?? "segment" }}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(tabsListVariants({ variant, size }), className)}
        {...props}
      />
    </TabsListContext.Provider>
  );
});
TabsList.displayName = "TabsList";

const tabsTriggerVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      listVariant: {
        segment:
          "px-2.5 py-1.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card",
        underlined:
          "-mb-px rounded-none border-b-2 border-transparent px-1 pb-2.5 pt-1 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground",
      },
    },
    defaultVariants: { listVariant: "segment" },
  },
);

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  const list = React.useContext(TabsListContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        tabsTriggerVariants({ listVariant: list?.variant ?? "segment" }),
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("flex-1 outline-none focus-visible:ring-0", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants };
export type { TabsListVariant };

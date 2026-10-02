import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Gauge, LayoutDashboard, Menu, ScanText, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarPanel } from "@/components/navigation/Sidebar";
import { Logo } from "@/components/navigation/Logo";
import { MobileNav } from "@/components/navigation/MobileNav";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { useUiStore } from "@/store/uiStore";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/detector", label: "Detect", icon: ScanText },
  { to: "/paraphraser", label: "Rewrite", icon: Wand2 },
  { to: "/documents", label: "Files", icon: FileText },
  { to: "/reports", label: "Reports", icon: Gauge },
];

export function AppLayout() {
  const location = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <SidebarPanel />
      <MobileNav />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile / tablet header replaces the sidebar. */}
        <header className="sticky top-0 z-30 flex h-[calc(var(--header-height)+env(safe-area-inset-top))] items-center gap-2 border-b border-border bg-background/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:h-[var(--header-height)] lg:pt-0 print:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <Logo size={22} />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Search (Ctrl+K)"
            >
              <span className="font-mono text-xs" aria-hidden="true">
                ⌘K
              </span>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {/* Entry animation only — an exit transition would gate the new route's mount on the
            outgoing page finishing, leaving the content area blank if that never completes. */}
        <motion.main
          key={location.pathname}
          id="main-content"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </motion.main>

        <nav
          aria-label="Primary sections"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
        >
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[0.625rem] font-medium text-muted-foreground transition-colors",
                    isActive && "text-primary",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("size-[18px]", isActive && "stroke-[2.2]")} aria-hidden="true" />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status">
      <span className="sr-only">Loading page</span>
      <div className="w-full max-w-md space-y-3 px-6">
        <div className="skeleton h-4 w-28 rounded-sm" />
        <div className="skeleton h-8 w-1/2 rounded-sm" />
        <div className="skeleton h-64 w-full rounded-md" />
      </div>
    </div>
  );
}

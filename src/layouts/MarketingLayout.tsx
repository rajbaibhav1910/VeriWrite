import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { TopNav } from "@/components/navigation/TopNav";
import { Footer } from "@/components/navigation/Footer";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/** Marketing chrome: top navigation, content, footer. */
export function MarketingLayout({ container = true }: { container?: boolean }) {
  const location = useLocation();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <TopNav />
      <motion.main
        key={location.pathname}
        id="main-content"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={cn("flex-1", container && "mx-auto w-full max-w-[86rem] px-4 sm:px-6 lg:px-8")}
      >
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </motion.main>
      <Footer />
    </div>
  );
}

/** Full-bleed variant for the landing page, which owns its own section widths. */
export function BareMarketingLayout() {
  return <MarketingLayout container={false} />;
}

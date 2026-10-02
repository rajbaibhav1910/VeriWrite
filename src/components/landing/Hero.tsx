import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

const STATS = [
  { value: "4", label: "classification bands" },
  { value: "9", label: "writing tools" },
  { value: "3", label: "analysis levels: sentence, paragraph, document" },
];

export function Hero() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] grid-lines opacity-[0.5] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-8 size-[26rem] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(circle at 50% 50%, var(--primary), transparent 68%)" }}
      />

      <div className="relative mx-auto grid max-w-[86rem] gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-card">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft">
              <ScanSearch className="size-3.5 text-primary" aria-hidden="true" />
            </span>
            <span className="text-2xs font-medium text-muted-foreground">
              Flagship: transparent AI detection
            </span>
          </span>

          <h1
            id="hero-heading"
            className="mt-6 text-balance text-4xl font-semibold leading-[1.06] tracking-tightest sm:text-5xl lg:text-[3.375rem]"
          >
            Detect AI.
            <br />
            <span className="text-muted-foreground">Understand Your Writing.</span>
          </h1>

          <p className="mt-5 text-balance text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">
            Analyze writing for signals associated with AI-generated and AI-assisted content with
            transparent, sentence-level insights — then paraphrase, correct, summarise and cite
            without leaving the document.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button asChild size="lg">
              <Link to="/detector">
                Try AI Detector
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#tools">Explore Tools</a>
            </Button>
          </div>

          <ul role="list" className="mt-9 grid grid-cols-3 gap-2.5 border-t border-border pt-5 sm:gap-4">
            {STATS.map((stat) => (
              <li key={stat.label}>
                <span className="block text-xl font-semibold tracking-tight tabular">
                  {stat.value}
                </span>
                <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: reducedMotion ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0"
        >
          <ProductPreview />
          <p className="mt-3 text-center text-2xs text-muted-foreground">
            Live demo — the bundled local engine runs in your browser. Nothing is uploaded.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

export type SectionTone = "default" | "surface" | "sunken";
export type SectionAlign = "left" | "center" | "split";

export interface SectionProps {
  /** Anchor target for in-page navigation (`#features`). */
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** `split` sets the heading left and the lede right — the editorial default here. */
  align?: SectionAlign;
  className?: string;
  tone?: SectionTone;
  children: ReactNode;
}

const TONE_CLASS: Record<SectionTone, string> = {
  default: "bg-background",
  surface: "border-y border-border bg-surface",
  sunken: "border-y border-border bg-surface-sunken",
};

/** One rhythm for every marketing section: container, header block, content. */
export function Section({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  className,
  tone = "default",
  children,
}: SectionProps) {
  const autoId = useId();
  const headingId = `${id ?? autoId}-title`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-20 lg:scroll-mt-24", TONE_CLASS[tone], className)}
    >
      <div className="mx-auto max-w-[86rem] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <header
          className={cn(
            "flex flex-col gap-5",
            align === "center" && "items-center text-center",
            align === "split" && "lg:flex-row lg:items-end lg:justify-between lg:gap-16",
          )}
        >
          <div className="min-w-0">
            {eyebrow ? <Eyebrow centered={align === "center"}>{eyebrow}</Eyebrow> : null}
            <h2
              id={headingId}
              className={cn(
                "mt-3 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-tightest text-balance sm:text-4xl lg:text-[2.75rem]",
                align === "center" && "mx-auto",
                align === "split" && "lg:max-w-[38rem]",
              )}
            >
              {title}
            </h2>
          </div>
          {description ? (
            <p
              className={cn(
                "max-w-xl shrink-0 text-[0.9375rem] leading-relaxed text-muted-foreground text-balance",
                align === "center" && "mx-auto max-w-2xl",
                align === "split" && "lg:max-w-md",
              )}
            >
              {description}
            </p>
          ) : null}
        </header>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}

export function Eyebrow({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        centered && "justify-center",
      )}
    >
      <span aria-hidden className="h-px w-6 bg-primary/45" />
      {children}
    </p>
  );
}

/** Short entrance reveal; rendered as a plain div when motion is not wanted. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = usePrefersReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.22, ease: "easeOut", delay: Math.min(delay, 0.16) }}
    >
      {children}
    </motion.div>
  );
}

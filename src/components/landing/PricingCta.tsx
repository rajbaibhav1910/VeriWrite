import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { PLANS, type PlanDefinition } from "@/config/plans";
import { cn } from "@/lib/utils";
import { Section } from "./Section";

function price(plan: PlanDefinition) {
  return plan.monthly === 0 ? "Free" : `$${plan.monthly}`;
}

export function PricingCta() {
  return (
    <Section
      id="plans"
      tone="surface"
      eyebrow="Plans"
      title="Start on Free, move up when the quotas are the constraint"
      description="Three published plans, listed at their actual prices. Nothing here is discounted, counted down or capped by a trial timer."
      align="split"
    >
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        {PLANS.map((plan) => {
          const headline = plan.quotas.find((row) => row.label === "AI detection analyses");

          return (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col bg-card p-6",
                plan.highlighted && "bg-primary-soft/40",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">{plan.name}</h3>
                {plan.highlighted ? (
                  <Badge variant="subtle" size="xs">
                    Recommended
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{plan.audience}</p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tightest">{price(plan)}</span>
                {plan.monthly > 0 ? (
                  <span className="text-xs text-muted-foreground">per month</span>
                ) : null}
              </p>
              <p className="mt-1 text-2xs text-muted-foreground">
                {plan.monthly > 0
                  ? `$${plan.annual}/mo billed annually · ${plan.billingNote}`
                  : plan.billingNote}
              </p>

              <ul className="mt-5 space-y-2 border-t border-border pt-4">
                {plan.features
                  .filter((feature) => feature.included)
                  .slice(0, 4)
                  .map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2 text-xs leading-relaxed">
                      <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-primary" />
                      <span className="text-muted-foreground">{feature.label}</span>
                    </li>
                  ))}
              </ul>

              <dl className="mt-5 border-t border-border pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-2xs text-muted-foreground">{headline?.label}</dt>
                  <dd className="tabular text-xs font-semibold">{headline?.value}</dd>
                </div>
              </dl>

              <Link
                to="/pricing"
                className="mt-5 inline-flex items-center gap-1.5 rounded-xs text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {plan.cta}
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </article>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          The detector itself is not behind a paywall on any plan: sentence-level scores, confidence and
          explanation cards are in the free tier. Paid tiers add volume, source matching and exportable
          reports.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/detector"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-card outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Try the AI Detector
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3.5 text-sm font-medium shadow-card outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Compare all plans
          </Link>
        </div>
      </div>
    </Section>
  );
}

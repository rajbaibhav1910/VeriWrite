import { GraduationCap, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@/config/plans";
import { formatNumber, MAX_WORDS } from "@/lib/utils";
import type { Plan } from "@/types";
import { Reveal, Section } from "./Section";

const CHECKS = [
  {
    title: "Whether an assisted paragraph still sounds like you",
    detail: "Rewrite one section, re-run it, and watch which sentences keep firing the same signals.",
  },
  {
    title: "Where the writing goes flat",
    detail: "Uniform sentence length and stock transitions are the two easiest things to fix once you can see them.",
  },
  {
    title: "Whether a borrowed passage is credited",
    detail: "Detection measures style; citation handles attribution. They are different jobs and both are yours.",
  },
  {
    title: "Whether a summary kept the claim intact",
    detail: "Condense a section, compare it against the original, then keep both in the same document.",
  },
];

const CITATION_STYLES = ["APA", "MLA", "Chicago", "Harvard", "IEEE"];

function quota(planId: Plan, label: string) {
  const row = PLANS.find((p) => p.id === planId)?.quotas.find((q) => q.label === label);
  return row?.value ?? "—";
}

export function AudienceStudents() {
  return (
    <Section
      id="students"
      tone="surface"
      eyebrow="Students & academics"
      title="Use the score to revise, not to argue"
      description="For most students the detector is a mirror, not a referee: it shows which sentences read as assisted so you can decide what to keep. It cannot prove who wrote anything, and it should never be used as that."
      align="split"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            What you check before you submit
          </h3>
          <ul className="mt-4">
            {CHECKS.map((check, index) => (
              <li key={check.title} className="flex gap-4 border-b border-border py-5">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border border-border bg-card font-mono text-2xs text-muted-foreground"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-tight">{check.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {check.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <Reveal className="mt-8">
            <figure className="rounded-lg border-l-2 border-primary bg-card px-6 py-6 shadow-card">
              <Quote aria-hidden className="size-5 text-primary/70" />
              <blockquote className="mt-3 font-serif text-lg leading-relaxed tracking-tight text-balance">
                I run a draft the way I used to read it aloud: to find the sentence that stopped
                sounding like me. The report just tells me which line to look at first.
              </blockquote>
              <figcaption className="mt-4 text-xs text-muted-foreground">
                Illustrative example of a self-review workflow — not a customer testimonial or a
                quotation from a real student.
              </figcaption>
            </figure>
          </Reveal>

          <div className="mt-8 rounded-lg border border-border bg-card p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary"
              >
                <GraduationCap className="size-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight">
                  A detector is a self-review aid, never proof of authorship
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  False positives happen: careful formal writing, non-first-language prose and heavily
                  edited drafts all trip machine-leaning signals. Institutional tools measure
                  differently and can disagree with this one on the same file. Keep your working
                  versions, notes and citation trail — that record says more about authorship than any
                  percentage does.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Check your department's policy before you rely on a result in either direction.{" "}
                  <Link
                    to="/legal/ai-detection-limitations"
                    className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                  >
                    Why results are estimates
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside aria-label="Getting started for students" className="min-w-0">
          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Free plan, in numbers
              </h3>
              <dl className="mt-3 divide-y divide-border border-y border-border">
                {[
                  ["AI detection analyses", quota("free", "AI detection analyses")],
                  ["Words per month", quota("free", "Words processed per month")],
                  ["Saved documents", quota("free", "Saved documents")],
                  ["History retained", quota("free", "History retained")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="tabular text-xs font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                A single analysis accepts up to {formatNumber(MAX_WORDS)} words. No card required.
              </p>
              <p className="mt-3 text-xs">
                <Link
                  to="/pricing"
                  className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
                >
                  Compare plans
                </Link>
              </p>
            </div>

            <Reveal className="rounded-lg border border-border bg-card p-5 shadow-card" delay={0.04}>
              <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Cite it properly
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                If the idea came from somewhere, reference it. The citation generator builds in-text
                and bibliography output in five styles.
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {CITATION_STYLES.map((style) => (
                  <li key={style}>
                    <Badge variant="subtle" size="xs">
                      {style}
                    </Badge>
                  </li>
                ))}
              </ul>
              <Link
                to="/citations"
                className="mt-4 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Open the citation generator
              </Link>
            </Reveal>
          </div>
        </aside>
      </div>
    </Section>
  );
}

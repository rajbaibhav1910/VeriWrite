import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eyebrow, Reveal, Section } from "./Section";

/** Who the product is actually built for — a positioning band, not a customer list. */
const AUDIENCES = [
  {
    label: "University writing centres",
    detail:
      "Tutors and students looking at the same draft, with every score traceable to a sentence.",
  },
  {
    label: "Editorial teams",
    detail: "Copy desks that need a documented check before a piece is signed off, not a hunch.",
  },
  {
    label: "Content studios",
    detail: "Agencies reviewing output from several writers under one house style.",
  },
  {
    label: "Research groups",
    detail: "Authors auditing prose before submission, where wording carries methodological weight.",
  },
  {
    label: "Freelance writers",
    detail: "Independents who want to see how their own voice reads before it leaves the drafts folder.",
  },
];

/** Invented, deliberately generic placeholders so no real organisation is implied. */
const PLACEHOLDER_WORDMARKS = [
  { name: "Northfield Writing Centre", style: "font-serif text-[0.9375rem] italic" },
  { name: "ASHGROVE REVIEW", style: "text-xs font-semibold tracking-[0.22em]" },
  { name: "Kestrel Content Studio", style: "text-sm font-semibold tracking-tight" },
  { name: "linden university library", style: "font-mono text-xs" },
  { name: "Harlow Press Editorial", style: "font-serif text-sm font-semibold tracking-tight" },
  { name: "MERIDIAN RESEARCH GROUP", style: "font-mono text-2xs font-semibold tracking-[0.16em]" },
];

const CELL =
  "flex min-h-16 items-center px-5 py-5 text-muted-foreground " +
  "border-b border-border last:border-b-0 " +
  "sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(2)]:border-b-0 " +
  "lg:[&:nth-child(2n)]:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0 " +
  "lg:[&:nth-last-child(3)]:border-b-0 lg:[&:nth-last-child(2)]:border-b-0 lg:last:border-b-0";

export function TrustedBy() {
  return (
    <Section
      id="built-for"
      eyebrow="Who it is for"
      title="Built for people who are accountable for the text"
      description="VeriWrite is not sold on catching anybody. It is shaped by the roles that read writing closely and then have to explain a judgement about it."
      align="split"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Reveal className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-5 py-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Environments the tools are tested against
              </p>
              <Badge variant="outline" size="xs" className="hidden sm:inline-flex">
                Illustrative
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {PLACEHOLDER_WORDMARKS.map((mark) => (
                <div key={mark.name} className={cn(CELL)} title="Invented placeholder name">
                  <span className={cn("leading-snug", mark.style)}>{mark.name}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Those wordmarks are invented placeholders. They exist to show the kinds of organisation
            this product is designed around, and are not customers, clients or endorsements.
          </p>
        </Reveal>

        <div className="min-w-0">
          <Eyebrow>Reader roles</Eyebrow>
          <ul className="mt-4">
            {AUDIENCES.map((audience) => (
              <li key={audience.label} className="border-t border-border py-4 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold tracking-tight">{audience.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{audience.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

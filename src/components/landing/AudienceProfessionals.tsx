import { ArrowRight, Briefcase, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/config/plans";
import { Reveal, Section } from "./Section";

const WORKFLOW = [
  {
    stage: "Intake",
    what: "Open the brief as a document instead of a thread: TXT, DOCX or PDF in, one file to work from.",
    to: "/workspace",
    where: "Workspace",
  },
  {
    stage: "Draft",
    what: "Continue, outline and reshape inside the same text rather than pasting between tabs.",
    to: "/writer",
    where: "AI Writer",
  },
  {
    stage: "Edit",
    what: "Grammar, clarity and style issues are accepted or ignored one at a time, so the voice stays yours.",
    to: "/grammar",
    where: "Grammar Checker",
  },
  {
    stage: "Verify",
    what: "Run detection and source matching before the file leaves, and read the flagged sentences yourself.",
    to: "/detector",
    where: "Detector & Plagiarism",
  },
  {
    stage: "Deliver",
    what: "Export the report as the record of what the text measured at hand-off — attach it to the delivery.",
    to: "/reports",
    where: "Reports",
  },
  {
    stage: "Recall",
    what: "Folders, favourites and history keep earlier versions retrievable when a client asks a month later.",
    to: "/documents",
    where: "Documents",
  },
];

const team = PLANS.find((plan) => plan.id === "team");
const teamSeats = team?.quotas.find((row) => row.label === "Concurrent seats")?.value ?? "5+";
const teamAnalyses = team?.quotas.find((row) => row.label === "AI detection analyses")?.value;
const teamWords = team?.quotas.find((row) => row.label === "Words processed per month")?.value;
const teamFeatures = (team?.features ?? []).filter((feature) => feature.included).slice(1, 5);

export function AudienceProfessionals() {
  return (
    <Section
      id="professionals"
      eyebrow="Professionals & teams"
      title="A working record from first draft to client deliverable"
      description="Teams do not need a verdict; they need a traceable process. Each stage below happens in the same document, and each one leaves an artefact you can hand to a client or a colleague."
      align="split"
    >
      <Reveal className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <caption className="sr-only">
            The six stages of a professional writing workflow in VeriWrite
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-32 py-3 pr-6 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Stage
              </th>
              <th scope="col" className="py-3 pr-6 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                What happens
              </th>
              <th scope="col" className="w-52 py-3 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Where
              </th>
            </tr>
          </thead>
          <tbody>
            {WORKFLOW.map((row) => (
              <tr key={row.stage} className="border-b border-border align-top last:border-b-0">
                <th
                  scope="row"
                  className="py-5 pr-6 text-sm font-semibold tracking-tight text-foreground"
                >
                  {row.stage}
                </th>
                <td className="py-5 pr-6 text-sm leading-relaxed text-muted-foreground">{row.what}</td>
                <td className="py-5">
                  <Link
                    to={row.to}
                    className="inline-flex items-center gap-1.5 rounded-xs text-xs font-medium underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
                  >
                    {row.where}
                    <ArrowRight aria-hidden className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Briefcase aria-hidden className="size-4 text-primary" />
            What changes when a team runs it
          </h3>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              "Shared folders, so a reviewer opens the same document rather than a copy",
              "Reports with a timestamped classification, useful as evidence of process",
              "One quota pool instead of five separate free accounts",
              "Admin visibility of usage, so capacity is a number and not a guess",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            Editorial judgement stays with the named reviewer. The tooling records what was measured;
            it does not sign anything off.
          </p>
        </div>

        <div className="rounded-lg border border-primary/35 bg-card p-6 shadow-raised">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Users aria-hidden className="size-4 text-primary" />
                {team?.name ?? "Team"} plan
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{team?.audience}</p>
            </div>
            {team ? (
              <Badge variant="subtle" size="xs">
                ${team.monthly}/mo
              </Badge>
            ) : null}
          </div>

          <dl className="mt-4 divide-y divide-border border-y border-border">
            {[
              ["Seats", teamSeats],
              ["Detection analyses", teamAnalyses ?? "—"],
              ["Words per month", teamWords ?? "—"],
              ["Billing", team?.billingNote ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="tabular text-right text-xs font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 space-y-1.5">
            {teamFeatures.map((feature) => (
              <li key={feature.label} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-border" />
                {feature.label}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/pricing">
                See the full comparison
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/contact">Talk to us</Link>
            </Button>
          </div>
          <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
            Prices and quotas are read from the published plan table. Nothing here is discounted or
            time-limited.
          </p>
        </div>
      </div>
    </Section>
  );
}

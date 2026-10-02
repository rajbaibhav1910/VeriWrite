import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MAX_WORDS, MIN_WORDS, cn, formatNumber } from "@/lib/utils";
import type { AnalysisPhase, SignalName } from "@/types";
import { Reveal, Section } from "./Section";

const STEPS = [
  {
    n: "01",
    title: "Paste, or drop in a file",
    body: "Text goes in as plain writing or as a TXT, DOCX or PDF upload. The document is normalised into paragraphs and sentences before anything is scored, so the numbers you see line up with the sentence you are reading.",
  },
  {
    n: "02",
    title: "Analyse the whole draft",
    body: "One pass measures the feature set — sentence-length spread, lexical diversity, transition habits, syntactic shape — and returns a probability per sentence plus a document-level view. No step is hidden behind a spinner you cannot question.",
  },
  {
    n: "03",
    title: "Inspect what was flagged, and why",
    body: "Each span carries its own signals and an explanation card in plain language. Read the flagged sentence, decide whether the tool is right, and move on: the judgement stays with you.",
  },
  {
    n: "04",
    title: "Revise, then export the record",
    body: "Send a passage to the paraphraser or grammar checker and re-run to watch the breakdown move. When it reads the way you want, keep the report as an exportable record of what the text measured at that moment.",
  },
];

const PHASES: AnalysisPhase[] = [
  "preparing",
  "normalizing",
  "analyzing",
  "scoring",
  "reporting",
];

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Preparing",
  normalizing: "Normalizing",
  analyzing: "Analyzing",
  scoring: "Scoring",
  reporting: "Reporting",
};

/** Labels for the real `SignalName` union in the domain model. */
const SIGNALS: Array<{ name: SignalName; label: string; note: string; leans: "ai" | "human" }> = [
  { name: "predictable_phrasing", label: "Predictable phrasing", note: "wording that tracks familiar patterns", leans: "ai" },
  { name: "low_sentence_variation", label: "Low sentence variation", note: "lengths that stay in a narrow band", leans: "ai" },
  { name: "repetitive_structure", label: "Repetitive structure", note: "openings that repeat across neighbours", leans: "ai" },
  { name: "generic_transition", label: "Generic transition", note: "stock connectives doing little work", leans: "ai" },
  { name: "uniform_sentence_length", label: "Uniform sentence length", note: "little spread between sentences", leans: "ai" },
  { name: "lexical_diversity", label: "Lexical diversity", note: "how much the vocabulary repeats", leans: "ai" },
  { name: "burstiness", label: "Burstiness", note: "short and long sentences alternating", leans: "ai" },
  { name: "syntactic_complexity", label: "Syntactic complexity", note: "depth and regularity of clause structure", leans: "ai" },
  { name: "hedging_density", label: "Hedging density", note: "qualifiers softening each claim", leans: "ai" },
  { name: "list_bias", label: "List bias", note: "ideas laid out in parallel stacks", leans: "ai" },
  { name: "human_marker", label: "Human marker", note: "personal, idiosyncratic or conversational tells", leans: "human" },
];

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Four steps, and nothing hidden between them"
      description="The pipeline is short on purpose. Every number in a VeriWrite report can be traced back to a specific sentence and a named signal."
      align="split"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
        <ol className="min-w-0">
          {STEPS.map((step, index) => (
            <li key={step.n}>
              <Reveal delay={index * 0.02}>
                <div className="grid gap-4 border-t border-border py-8 first:border-t-0 first:pt-0 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-6">
                  <div className="flex flex-col items-start gap-2">
                    <span className="tabular font-mono text-sm font-semibold text-primary">{step.n}</span>
                    <span
                      aria-hidden
                      className="hidden h-full w-px bg-border sm:block"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{step.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    <div className="mt-5">{index === 0 ? <InputVisual /> : null}</div>
                    <div className="mt-5">{index === 1 ? <PhaseVisual /> : null}</div>
                    <div className="mt-5">{index === 2 ? <FlagVisual /> : null}</div>
                    <div className="mt-5">{index === 3 ? <ExportVisual /> : null}</div>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <aside aria-label="Signals we measure" className="min-w-0">
          <div className="rounded-lg border border-border bg-card p-5 shadow-card lg:sticky lg:top-24">
            <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Signals we measure
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              The exact signal names the engine reports. Each one is a measured property of the prose,
              never a claim about a person.
            </p>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {SIGNALS.map((signal) => (
                <li key={signal.name} className="flex items-start gap-2.5 py-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      signal.leans === "ai" ? "bg-signal-ai" : "bg-signal-human",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-tight">{signal.label}</span>
                    <span className="block text-2xs leading-relaxed text-muted-foreground">{signal.note}</span>
                    <code className="mt-1 block font-mono text-2xs text-muted-foreground">{signal.name}</code>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
              <span aria-hidden className="mt-1 flex gap-1">
                <span className="size-1.5 rounded-full bg-signal-ai" />
                <span className="size-1.5 rounded-full bg-signal-human" />
              </span>
              Machine-leaning readings and the one explicitly human marker, shown side by side so a
              score never arrives as a single colour.
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          One analysis accepts between {formatNumber(MIN_WORDS)} and {formatNumber(MAX_WORDS)} words.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/detector">
            Run it on your own text
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </Section>
  );
}

function InputVisual() {
  return (
    <div className="max-w-md overflow-hidden rounded-md border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="font-mono text-2xs text-muted-foreground">draft.md</span>
        <span className="ml-auto text-2xs text-muted-foreground">1,284 words</span>
      </div>
      <div className="space-y-1.5 p-3" aria-hidden>
        <span className="block h-1.5 w-full rounded-full bg-border" />
        <span className="block h-1.5 w-[92%] rounded-full bg-border" />
        <span className="block h-1.5 w-[78%] rounded-full bg-border" />
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2.5">
        {["TXT", "DOCX", "PDF"].map((type) => (
          <span
            key={type}
            className="rounded-xs border border-border bg-card px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
          >
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

function PhaseVisual() {
  return (
    <ol className="flex max-w-lg flex-wrap gap-x-6 gap-y-2" aria-label="Analysis phases, in order">
      {PHASES.map((phase, index) => (
        <li key={phase} className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn("size-1.5 rounded-full", index < 4 ? "bg-primary" : "bg-border")}
          />
          <span className="font-mono text-2xs text-muted-foreground">{PHASE_LABEL[phase]}</span>
        </li>
      ))}
    </ol>
  );
}

function FlagVisual() {
  const lines = [
    {
      text: "The pilot ran for eleven weeks in two clinics.",
      detail: "consistent with human authorship",
      mark: "bg-signal-human-bg decoration-signal-human",
    },
    {
      text: "Moreover, it is important to note the outcome was positive.",
      detail: "flagged: generic transition, predictable phrasing",
      mark: "bg-signal-ai-bg decoration-signal-ai",
    },
    {
      text: "Half the cohort dropped out before week four.",
      detail: "no signal fired",
      mark: "bg-signal-neutral-bg decoration-signal-neutral",
    },
  ];

  return (
    <ul className="max-w-xl space-y-1.5">
      {lines.map((line) => (
        <li key={line.text} className="flex items-start gap-3">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
          <span className="min-w-0">
            <span
              className={cn(
                "rounded-xs px-0.5 text-sm leading-relaxed underline decoration-1 underline-offset-4",
                line.mark,
              )}
            >
              {line.text}
            </span>
            <span className="mt-0.5 block font-mono text-2xs text-muted-foreground">{line.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExportVisual() {
  const rows = [
    ["Document", "Field notes — draft 4"],
    ["AI probability", "34% (moderate confidence)"],
    ["Classification", "Human-written & AI-refined"],
    ["Sentences flagged", "6 of 41"],
  ];

  return (
    <div className="max-w-md overflow-hidden rounded-md border border-border bg-card shadow-card">
      <div className="border-b border-border px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
        Report
      </div>
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="text-2xs text-muted-foreground">{label}</dt>
            <dd className="text-right text-2xs font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

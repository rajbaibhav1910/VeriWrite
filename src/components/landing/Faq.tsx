import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PLANS } from "@/config/plans";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { formatNumber, MAX_WORDS, MIN_WORDS } from "@/lib/utils";
import type { Plan } from "@/types";
import { Section } from "./Section";

/** Reads a quota straight out of the plan table so the answer cannot go stale. */
function quota(planId: Plan, label: string) {
  const plan = PLANS.find((entry) => entry.id === planId);
  return plan?.quotas.find((row) => row.label === label)?.value ?? "—";
}

const QUESTIONS: Array<{ q: string; a: ReactNode }> = [
  {
    q: "How accurate is the AI detector, and does it produce false positives?",
    a: (
      <>
        It is a probabilistic classifier over writing signals, so yes: formal, highly consistent prose,
        translated text and heavily edited drafts can all read as machine-like. That is why the product
        prints a confidence label and the signals behind each span instead of a bare verdict. Treat a
        high score as a request to look at particular sentences, not as a finding about a person.{" "}
        <Link
          to="/legal/ai-detection-limitations"
          className="font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          The limitations page
        </Link>{" "}
        lists the failure modes we design around.
      </>
    ),
  },
  {
    q: "Does VeriWrite store the text I paste?",
    a: (
      <>
        Analysis runs in the browser unless the deployment attaches a backend, and what is kept locally
        is governed by one setting:{" "}
        <strong className="font-semibold">Save documents locally</strong>, available in{" "}
        <Link
          to="/settings"
          className="font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          settings
        </Link>
        . Switch it off and text still analyses normally — it simply is not written to storage or added
        to your history.
      </>
    ),
  },
  {
    q: "If I get a high AI score, does that prove the writing is not mine?",
    a: "No. Nothing in a detection result establishes authorship, and no VeriWrite output should be used as disciplinary evidence. Your working files — earlier drafts, notes, edit history, version timestamps — say far more than any percentage, which is exactly why the workspace keeps them.",
  },
  {
    q: "What are the limits on each plan?",
    a: (
      <>
        Free covers {quota("free", "AI detection analyses")} detection analyses and{" "}
        {quota("free", "Words processed per month")} words a month, with{" "}
        {quota("free", "Saved documents")} saved documents and {quota("free", "History retained")}{" "}
        history. Pro raises detection to {quota("pro", "AI detection analyses")} analyses and adds
        plagiarism matching ({quota("pro", "Plagiarism scans")} a month) plus downloadable reports. Team
        runs {quota("team", "Concurrent seats")} seats with shared folders and admin controls. The whole
        table is on{" "}
        <Link
          to="/pricing"
          className="font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          the pricing page
        </Link>
        .
      </>
    ),
  },
  {
    q: "How much text can I analyse at once?",
    a: `A single run accepts between ${formatNumber(MIN_WORDS)} and ${formatNumber(MAX_WORDS)} words. Anything shorter gets a message instead of a score, because very short text produces numbers that look confident and are not. Longer material is split into documents you can run section by section.`,
  },
  {
    q: "Which languages are supported, and does non-English text work?",
    a: "The tools accept the thirteen language codes the settings list offers: English, Spanish, French, German, Portuguese, Italian, Dutch, Chinese, Japanese, Korean, Russian, Arabic and Hindi. Signal behaviour is strongest on English; elsewhere expect lower confidence labels rather than silent overconfidence, and remember that translated text can carry machine-like structure from the translation step itself.",
  },
  {
    q: "What happens when I upload a PDF or DOCX?",
    a: "Uploads are checked by declared type and by size before anything is parsed — TXT, DOCX and PDF are accepted, anything else is refused with a specific reason. The file is converted to plain text and enters the same pipeline the paste path uses, so page layout is not preserved but sentence boundaries are, and flagged spans still point at the exact line they came from.",
  },
  {
    q: "Why four classifications instead of AI or human?",
    a: (
      <>
        Because most submissions sit between the poles. A document written by a person and tidied by a
        model is a different object from one generated by a model and then edited, and the four labels
        — AI-generated, AI-generated &amp; AI-refined, Human-written &amp; AI-refined, Human-written —
        keep that difference visible. The share of probability across all four is shown together in{" "}
        <Link
          to="/detector"
          className="font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          the detector
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can I change plans, and how do refunds work?",
    a: "Plans are month to month. An upgrade applies immediately and the quota counters on the usage page follow it in the same session; a downgrade takes effect at the next renewal so you keep what you paid for. Billing is invoiced on Team. If a charge looks wrong, raise it with support rather than waiting for the renewal — the contact route is in the footer.",
  },
  {
    q: "Can a team or institution run its own checks here?",
    a: (
      <>
        Yes, on the Team plan: shared folders, an audit trail of runs and team usage analytics. Detection
        still reports estimates per sentence, so a written policy should state what a score does and
        does not justify before anyone is graded by it. See{" "}
        <Link
          to="/legal/responsible-ai"
          className="font-medium underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          Responsible AI
        </Link>{" "}
        for the framing every deployment is asked to keep.
      </>
    ),
  },
];

const HALF = 5;

export function Faq() {
  const group = useId();
  const reduceMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section
      id="faq"
      eyebrow="Questions"
      title="The hard questions, answered at length"
      description="Detection tools get asked the same handful of uncomfortable things. These are the answers this product gives, including the ones that make it sound less capable than it could claim to be."
      align="split"
    >
      <div className="grid gap-x-14 lg:grid-cols-2">
        {[QUESTIONS.slice(0, HALF), QUESTIONS.slice(HALF)].map((column, columnIndex) => (
          <dl key={columnIndex} className="min-w-0">
            {column.map((item, itemIndex) => {
              const index = columnIndex * HALF + itemIndex;
              return (
                <Entry
                  key={item.q}
                  group={group}
                  index={index}
                  question={item.q}
                  answer={item.a}
                  open={open === index}
                  reduceMotion={reduceMotion}
                  onToggle={() => setOpen(open === index ? null : index)}
                />
              );
            })}
          </dl>
        ))}
      </div>

      <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        Not covered here?{" "}
        <Link
          to="/help"
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          The help centre
        </Link>{" "}
        goes deeper on reading signals, reports and plan limits.
      </p>
    </Section>
  );
}

function Entry({
  group,
  index,
  question,
  answer,
  open,
  reduceMotion,
  onToggle,
}: {
  group: string;
  index: number;
  question: string;
  answer: ReactNode;
  open: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
}) {
  const buttonId = `${group}-q${index}`;
  const panelId = `${group}-p${index}`;

  const body = (
    <div
      id={panelId}
      role="region"
      aria-labelledby={buttonId}
      className="max-w-prose pb-5 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground"
    >
      {answer}
    </div>
  );

  return (
    <div className="border-t border-border last:border-b">
      <dt>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-start gap-4 rounded-xs py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="flex-1 text-sm font-semibold tracking-tight">{question}</span>
          <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
            {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
          </span>
        </button>
      </dt>

      {reduceMotion ? (
        open ? (
          <dd>{body}</dd>
        ) : null
      ) : (
        <AnimatePresence initial={false}>
          {open ? (
            <motion.dd
              key={panelId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              {body}
            </motion.dd>
          ) : null}
        </AnimatePresence>
      )}
    </div>
  );
}

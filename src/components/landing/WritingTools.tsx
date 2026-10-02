import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { TOOLS } from "@/config/navigation";
import type {
  CitationStyle,
  IssueCategory,
  LanguageCode,
  ParaphraseMode,
  ToolId,
} from "@/types";
import { Section } from "./Section";

/** Chip lists are built from the domain enums so they cannot drift from what tools accept. */
const PARAPHRASE_MODES: ParaphraseMode[] = [
  "standard",
  "fluency",
  "formal",
  "academic",
  "simple",
  "creative",
  "professional",
];

const PARAPHRASE_LABEL: Record<ParaphraseMode, string> = {
  standard: "Standard",
  fluency: "Fluency",
  formal: "Formal",
  academic: "Academic",
  simple: "Simple",
  creative: "Creative",
  professional: "Professional",
};

const ISSUE_CATEGORIES: IssueCategory[] = ["grammar", "spelling", "punctuation", "clarity", "style"];

const ISSUE_LABEL: Record<IssueCategory, string> = {
  grammar: "Grammar",
  spelling: "Spelling",
  punctuation: "Punctuation",
  clarity: "Clarity",
  style: "Style",
};

const CITATION_STYLES: CitationStyle[] = ["apa", "mla", "chicago", "harvard", "ieee"];

const CITATION_LABEL: Record<CitationStyle, string> = {
  apa: "APA",
  mla: "MLA",
  chicago: "Chicago",
  harvard: "Harvard",
  ieee: "IEEE",
};

const LANGUAGES: LanguageCode[] = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "nl",
  "zh",
  "ja",
  "ko",
  "ru",
  "ar",
  "hi",
];

interface CatalogueEntry {
  detail: string;
  chips: string[];
}

const CATALOGUE: Record<ToolId, CatalogueEntry> = {
  detector: {
    detail:
      "Reads a passage at three granularities and reports probability, confidence and the signals behind each span.",
    chips: [
      "Sentence level",
      "Paragraph level",
      "Document level",
      "Confidence bands",
      "Explanation cards",
    ],
  },
  paraphraser: {
    detail: "Seven rewrite modes over the same passage, with the changed-word count kept visible.",
    chips: PARAPHRASE_MODES.map((mode) => PARAPHRASE_LABEL[mode]),
  },
  humanizer: {
    detail: "Works on rhythm, hedges and stiff constructions so assisted text reads like a person wrote it.",
    chips: ["Sentence rhythm", "Hedge trimming", "Concrete wording", "Register check"],
  },
  grammar: {
    detail: "Rule and style checks over five categories, each issue shown in context with an explanation.",
    chips: ISSUE_CATEGORIES.map((category) => ISSUE_LABEL[category]),
  },
  plagiarism: {
    detail: "Matched spans against the source list, with the overlapping text shown side by side.",
    chips: ["Matched spans", "Source list", "Originality score", "Side-by-side snippet"],
  },
  summarizer: {
    detail: "Three output formats over the same document, plus a visible compression ratio.",
    chips: ["Paragraph", "Bullets", "Key points", "Keywords"],
  },
  translator: {
    detail:
      "Two-column translation that keeps structure, so a result can be compared against the original line by line.",
    chips: [`${LANGUAGES.length} language codes`, "Register kept", "Side-by-side", "RTL aware"],
  },
  citations: {
    detail: "Reference builder with in-text and bibliography output for each supported style.",
    chips: CITATION_STYLES.map((style) => CITATION_LABEL[style]),
  },
  writer: {
    detail: "Drafting, continuation and outlining actions that operate on the open document.",
    chips: ["Draft", "Continue", "Outline", "Reshape selection"],
  },
};

const COLUMNS = [TOOLS.slice(0, 5), TOOLS.slice(5)];

export function WritingTools() {
  return (
    <Section
      id="tools"
      eyebrow="The catalogue"
      title={`All ${TOOLS.length} tools, listed by what you can set`}
      description="Every chip below is an option a tool accepts, not a marketing adjective. One shared document model runs underneath all of them."
      align="split"
    >
      <div className="grid gap-x-14 lg:grid-cols-2">
        {COLUMNS.map((column, columnIndex) => (
          <ul key={columnIndex} className="min-w-0">
            {column.map((tool) => {
              const entry = CATALOGUE[tool.tool];
              return (
                <li
                  key={tool.path}
                  className="border-t border-border py-6 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <Link
                      to={tool.path}
                      className="rounded-xs text-base font-semibold tracking-tight underline-offset-4 hover:text-primary hover:underline"
                    >
                      {tool.name}
                    </Link>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {tool.path}
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
                    {entry.detail}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {entry.chips.map((chip) => (
                      <li key={chip}>
                        <Badge variant="outline" size="xs">
                          {chip}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ))}
      </div>

      <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        Start with the one most people arrive for:{" "}
        <Link
          to="/detector"
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          the AI Detector
        </Link>
        . Everything else in this list feeds it or reads from it.
      </p>
    </Section>
  );
}

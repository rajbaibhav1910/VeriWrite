import {
  BookMarked,
  FolderOpen,
  Languages,
  ListChecks,
  type LucideIcon,
  PenLine,
  ScanText,
  ShieldCheck,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { TOOLS } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { ToolId } from "@/types";
import { Reveal, Section } from "./Section";

const ICONS: Record<ToolId, LucideIcon> = {
  detector: ScanText,
  paraphraser: Wand2,
  humanizer: Sparkles,
  grammar: Type,
  plagiarism: ShieldCheck,
  summarizer: ListChecks,
  translator: Languages,
  citations: BookMarked,
  writer: PenLine,
};

interface Tile {
  to: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  span: string;
  emphasis: "hero" | "wide" | "default";
}

/** Grid geometry lives here; every label and path still comes from `TOOLS`. */
const SPANS: Record<ToolId, { span: string; emphasis?: Tile["emphasis"] }> = {
  detector: { span: "sm:col-span-6 lg:col-span-5 lg:row-span-2", emphasis: "hero" },
  paraphraser: { span: "sm:col-span-3 lg:col-span-4" },
  grammar: { span: "sm:col-span-3 lg:col-span-3" },
  humanizer: { span: "sm:col-span-3 lg:col-span-3" },
  plagiarism: { span: "sm:col-span-3 lg:col-span-4" },
  summarizer: { span: "sm:col-span-3 lg:col-span-4" },
  translator: { span: "sm:col-span-3 lg:col-span-3" },
  citations: { span: "sm:col-span-3 lg:col-span-5" },
  writer: { span: "sm:col-span-3 lg:col-span-5" },
};

const WORKSPACE_TILE: Tile = {
  to: "/workspace",
  name: "Document Workspace",
  tagline:
    "The shell every tool writes into: drafts, folders, autosaved text and the reports made from them.",
  icon: FolderOpen,
  span: "sm:col-span-6 lg:col-span-7",
  emphasis: "wide",
};

const DETECTOR_POINTS = [
  "Sentence, paragraph and document scores in one pass",
  "A confidence label attached to every number",
  "An explanation card for each flagged passage",
];

const WORKSPACE_POINTS = [
  { label: "Folders and favourites", detail: "Group drafts by project, pin what is live." },
  { label: "Autosave", detail: "Text is kept locally as you type — no save step to forget." },
  { label: "Reports from history", detail: "Reopen an analysis without pasting the text again." },
];

export function FeatureOverview() {
  const tiles: Tile[] = TOOLS.flatMap<Tile>((meta) => {
    const layout = SPANS[meta.tool];
    if (!layout) return [];
    return [
      {
        to: meta.path,
        name: meta.name,
        tagline: meta.tagline,
        icon: ICONS[meta.tool],
        span: layout.span,
        emphasis: layout.emphasis ?? "default",
      },
    ];
  }).concat(WORKSPACE_TILE);

  return (
    <Section
      id="platform"
      tone="surface"
      eyebrow="The platform"
      title="Nine tools, one document, one set of numbers"
      description="Detection is the flagship, but the same text carries through the rewriting, checking, citation and storage tools — a score and the edit that changed it stay in one place."
      align="split"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6 sm:gap-5">
        {tiles.map((tile, index) => (
          <Reveal key={tile.to} className={cn("min-w-0", tile.span)} delay={index * 0.015}>
            <TileCard tile={tile} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const { icon: Icon, emphasis } = tile;
  const hero = emphasis === "hero";
  const wide = emphasis === "wide";

  return (
    <Link
      to={tile.to}
      className={cn(
        "group flex h-full flex-col rounded-lg border border-border bg-card shadow-card outline-none",
        "transition-[border-color,box-shadow] duration-150 hover:border-primary/45 hover:shadow-raised",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        hero ? "gap-6 p-6" : "p-5",
        wide && "sm:flex-row sm:items-stretch sm:gap-10",
      )}
    >
      <div className={cn("flex items-start gap-3", hero && "flex-col gap-4")}>
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary transition-colors group-hover:border-primary/40"
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">{tile.name}</h3>
            {hero ? (
              <Badge variant="subtle" size="xs">
                Flagship
              </Badge>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1.5 leading-relaxed text-muted-foreground",
              hero ? "max-w-md text-[0.9375rem]" : "text-xs",
              wide && "max-w-sm",
            )}
          >
            {tile.tagline}
          </p>
        </div>
      </div>

      {hero ? (
        <div className="mt-auto space-y-5">
          <SignalReadout />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {DETECTOR_POINTS.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-primary" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {wide ? (
        <ul className="mt-5 grid flex-1 gap-x-8 gap-y-4 border-t border-border pt-5 sm:mt-0 sm:grid-cols-1 sm:gap-y-3 sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0 lg:grid-cols-3">
          {WORKSPACE_POINTS.map((point) => (
            <li key={point.label}>
              <p className="text-xs font-semibold tracking-tight">{point.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {!hero ? (
        <p className="mt-auto pt-4 font-mono text-2xs text-muted-foreground transition-colors group-hover:text-foreground">
          {tile.to}
        </p>
      ) : null}
    </Link>
  );
}

/** Static per-sentence readout: a score shape, deliberately not an editor mock. */
function SignalReadout() {
  const rows = [
    { id: "S1", value: 12, bar: "bg-signal-human" },
    { id: "S2", value: 88, bar: "bg-signal-ai" },
    { id: "S3", value: 54, bar: "bg-signal-mixed" },
    { id: "S4", value: 9, bar: "bg-signal-human" },
  ];

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Per-sentence read
        </p>
        <p className="font-mono text-2xs text-muted-foreground">illustrative</p>
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3">
            <span className="w-6 shrink-0 font-mono text-2xs text-muted-foreground">{row.id}</span>
            <span className="h-1.5 min-w-0 flex-1 rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full", row.bar)}
                style={{ width: `${row.value}%` }}
              />
            </span>
            <span className="tabular w-9 shrink-0 text-right text-2xs text-muted-foreground">
              {row.value}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

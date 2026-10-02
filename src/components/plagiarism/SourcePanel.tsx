import { Check, ExternalLink, Quote, ScanText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { PlagiarismMatch, PlagiarismRun } from "@/services/plagiarismService";

export type PlagiarismTab = "sources" | "passages";

export interface SourcePanelProps {
  scan: PlagiarismRun;
  tab: PlagiarismTab;
  onTabChange(tab: PlagiarismTab): void;
  selectedMatch: string | null;
  onSelectMatch(id: string | null): void;
  /** The editor's text is no longer the text that was scanned, so marks are gone. */
  stale: boolean;
}

/**
 * The source panel: one card per matched source, with the passage it matched, its
 * similarity and its address, plus the same evidence ordered by where it sits in
 * the reader's own text. Selecting either entry is what paints the mark in the
 * editor, so a card can be read without hunting for the words it came from.
 */
export function SourcePanel({
  scan,
  tab,
  onTabChange,
  selectedMatch,
  onSelectMatch,
  stale,
}: SourcePanelProps) {
  const bySource = new Map<string, PlagiarismMatch[]>();
  for (const match of scan.matches) {
    const list = bySource.get(match.sourceId);
    if (list) list.push(match);
    else bySource.set(match.sourceId, [match]);
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Tabs value={tab} onValueChange={(value) => onTabChange(value as PlagiarismTab)} className="gap-0">
          <div className="border-b border-border px-4 pt-3">
            <TabsList size="sm" className="w-full justify-between">
              <TabsTrigger value="sources">
                Sources
                <span className="tabular opacity-70">{formatNumber(scan.sources.length)}</span>
              </TabsTrigger>
              <TabsTrigger value="passages">
                Passages
                <span className="tabular opacity-70">{formatNumber(scan.matches.length)}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sources" className="px-4 py-3">
            {scan.sources.length === 0 ? (
              <EmptyState
                compact
                icon={Check}
                title="Nothing in this corpus matched"
                description={
                  scan.engine === "demo-corpus"
                    ? `No run of eight shared words, and no sentence that shared most of its content words, with the ${formatNumber(scan.corpusSize)} passages bundled here. That is a clean result against this corpus only — it is not evidence that the text appears nowhere else.`
                    : "The similarity service searched its own index and returned no source. Ask that service what it covers before reading this as originality."
                }
              />
            ) : (
              <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {scan.sources.map((source) => {
                  const matches = bySource.get(source.id) ?? [];
                  return (
                    <li
                      key={source.id}
                      className={cn(
                        "rounded-lg border px-3 py-2.5",
                        matches.some((match) => match.id === selectedMatch)
                          ? "border-primary/45 bg-primary-soft"
                          : "border-border bg-surface",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 text-xs font-medium leading-snug">
                          {source.title}
                        </h4>
                        <Badge
                          variant={source.similarity >= 90 ? "error" : "warning"}
                          size="xs"
                        >
                          {source.similarity}%
                        </Badge>
                      </div>

                      <SourceUrl url={source.url} demo={scan.engine === "demo-corpus"} />

                      {source.publishedAt ? (
                        <p className="mt-1 text-2xs text-muted-foreground">
                          Published {formatDate(source.publishedAt)}
                        </p>
                      ) : null}

                      <p className="mt-2 border-l-2 border-border pl-2 text-2xs leading-relaxed text-muted-foreground">
                        {source.matchedText}
                      </p>

                      {matches.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {matches.map((match) => (
                            <li key={match.id}>
                              <MatchRow
                                match={match}
                                selected={match.id === selectedMatch}
                                stale={stale}
                                onSelect={onSelectMatch}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="passages" className="px-4 py-3">
            {scan.matches.length === 0 ? (
              <p className="text-2xs leading-relaxed text-muted-foreground">
                The scan reported {scan.originality}% unmatched words and no passage to show, so
                there is nothing to point at in your text.
              </p>
            ) : (
              <>
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  {formatNumber(scan.matches.length)} passages, in the order they appear in your
                  text. {stale ? "They cannot be painted until you scan the text again." : "Select one to jump to it."}
                </p>
                <ul className="mt-2 max-h-[26rem] space-y-1 overflow-y-auto pr-1">
                  {scan.matches.map((match) => (
                    <li key={match.id}>
                      <MatchRow
                        match={match}
                        selected={match.id === selectedMatch}
                        stale={stale}
                        onSelect={onSelectMatch}
                      />
                      <p className="mt-0.5 truncate pl-3 text-2xs text-muted-foreground">
                        {match.sourceTitle}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function MatchRow({
  match,
  selected,
  stale,
  onSelect,
}: {
  match: PlagiarismMatch;
  selected: boolean;
  stale: boolean;
  onSelect(id: string | null): void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? null : match.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full rounded-md border px-2.5 py-1.5 text-left transition-colors",
        selected
          ? "border-primary/45 bg-card"
          : "border-transparent bg-surface-sunken hover:border-border",
      )}
    >
      <span className="flex flex-wrap items-center gap-1.5 text-2xs">
        <Badge variant={match.kind === "verbatim" ? "error" : "info"} size="xs">
          {match.kind === "verbatim" ? "Verbatim" : "Reworded"}
        </Badge>
        <span className="tabular text-muted-foreground">
          {match.similarity}% · {formatNumber(match.words)} words
        </span>
        {stale ? <span className="ml-auto text-warning">text has changed</span> : null}
      </span>
      <span className="mt-1 block text-xs leading-snug text-foreground">
        <ScanText className="mr-1 inline size-3 align-[-2px] text-muted-foreground" aria-hidden />
        {match.matchedText}
      </span>
    </button>
  );
}

/** A demo corpus address is shown as text, not as a link out to `example.org`. */
function SourceUrl({ url, demo }: { url: string; demo: boolean }) {
  if (!url) {
    return <p className="mt-1 text-2xs text-muted-foreground">No address given by the service.</p>;
  }
  if (demo) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
        <Quote className="size-3" aria-hidden />
        <span className="min-w-0 break-all">{url}</span>
        <span className="text-warning">demo corpus entry, not a live source</span>
      </p>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-2xs text-primary underline-offset-2 hover:underline"
    >
      <ExternalLink className="size-3" aria-hidden />
      <span className="min-w-0 break-all">{url}</span>
    </a>
  );
}

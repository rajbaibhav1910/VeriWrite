import { Check, EyeOff, ListChecks, RotateCcw, Replace, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ISSUE_CATEGORY_LABEL, CONFIDENCE_LABEL, formatNumber } from "@/lib/utils";
import { GRAMMAR_CATEGORIES } from "@/services/grammarService";
import type { WritingStatistics } from "@/lib/tools/writingStats";
import type { GrammarIssue, IssueCategory } from "@/types";

export type GrammarTab = "issues" | "corrections" | "statistics";

export interface GrammarSidePanelProps {
  /** Every finding the checker reported, in document order. */
  issues: GrammarIssue[];
  /** Findings the current category filter leaves in the list. */
  visible: GrammarIssue[];
  tab: GrammarTab;
  onTabChange(tab: GrammarTab): void;
  selectedId: string | null;
  onSelect(id: string | null): void;
  accepted: GrammarIssue[];
  ignored: GrammarIssue[];
  onAccept(id: string): void;
  onIgnore(id: string): void;
  onRestore(id: string): void;
  onReplace(id: string): void;
  onApplyAll(): void;
  onClearQueue(): void;
  categoryFilter: IssueCategory[];
  onToggleCategory(category: IssueCategory): void;
  stats: WritingStatistics;
  /** The editor's text no longer matches the checked text, so no action is safe. */
  stale: boolean;
}

/**
 * The right-hand workspace for a grammar run: the findings, the corrections the
 * reader has queued, and the plain measurements of the text. Every action here
 * changes a finding's state or writes queued corrections into the document —
 * nothing is applied on its own, and an ignored finding is never edited.
 */
export function GrammarSidePanel(props: GrammarSidePanelProps) {
  const {
    issues,
    visible,
    tab,
    onTabChange,
    selectedId,
    onSelect,
    accepted,
    ignored,
    onAccept,
    onIgnore,
    onRestore,
    onReplace,
    onApplyAll,
    onClearQueue,
    categoryFilter,
    onToggleCategory,
    stats,
    stale,
  } = props;

  const current = issues.find((issue) => issue.id === selectedId) ?? null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Tabs value={tab} onValueChange={(value) => onTabChange(value as GrammarTab)} className="gap-0">
          <div className="border-b border-border px-4 pt-3">
            <TabsList size="sm" className="w-full justify-between">
              <TabsTrigger value="issues">
                Issues
                <span className="tabular opacity-70">{formatNumber(visible.length)}</span>
              </TabsTrigger>
              <TabsTrigger value="corrections">
                Corrections
                <span className="tabular opacity-70">{formatNumber(accepted.length)}</span>
              </TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="issues" className="px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {GRAMMAR_CATEGORIES.map((category) => {
                const active =
                  categoryFilter.length === 0 || categoryFilter.includes(category);
                const count = stats.byCategory[category];
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={categoryFilter.includes(category)}
                    onClick={() => onToggleCategory(category)}
                    className={
                      active
                        ? "rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-2xs font-medium text-foreground transition-colors"
                        : "rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {ISSUE_CATEGORY_LABEL[category]}
                    <span className="ml-1 tabular opacity-70">{formatNumber(count)}</span>
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                {issues.length === 0
                  ? "The checker found no pattern to report in the text it read. That means no rule matched, not that the text has no mistakes."
                  : "Every finding is in a category the filter hides. Turn a category back on to see them."}
              </p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {visible.map((issue) => (
                  <li key={issue.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(issue.id === selectedId ? null : issue.id)}
                      aria-current={issue.id === selectedId ? "true" : undefined}
                      className={
                        issue.id === selectedId
                          ? "w-full rounded-lg border border-primary/45 bg-primary-soft px-3 py-2 text-left"
                          : "w-full rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-primary/30"
                      }
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" size="xs">
                          {ISSUE_CATEGORY_LABEL[issue.category]}
                        </Badge>
                        {issue.state === "accepted" ? (
                          <Badge variant="success" size="xs">
                            Queued
                          </Badge>
                        ) : null}
                        {issue.state === "ignored" ? (
                          <Badge variant="subtle" size="xs">
                            Ignored
                          </Badge>
                        ) : null}
                        <span className="ml-auto text-2xs text-muted-foreground">
                          {CONFIDENCE_LABEL[issue.confidence]}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-foreground">
                        {issue.original}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {current ? (
              <div className="mt-3 rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {ISSUE_CATEGORY_LABEL[current.category]} explanation
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onSelect(null)}
                    aria-label="Close finding"
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </div>

                <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                  {current.explanation}
                </p>

                <p className="mt-2 flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="text-error line-through decoration-error/40">
                    {current.original}
                  </span>
                  {current.suggestion !== current.original && current.suggestion.length > 0 ? (
                    <span className="font-medium text-success">
                      <Replace className="mr-1 inline size-3 align-[-2px] text-muted-foreground" aria-hidden />
                      {current.suggestion}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      No single replacement — this one is advice, not a fix.
                    </span>
                  )}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {current.state === "open" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onAccept(current.id)}
                      disabled={stale || current.suggestion === current.original}
                    >
                      <Check className="size-3.5" aria-hidden />
                      Accept
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => onRestore(current.id)}>
                      <RotateCcw className="size-3.5" aria-hidden />
                      Undo decision
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => (current.state === "ignored" ? onRestore(current.id) : onIgnore(current.id))}
                  >
                    <EyeOff className="size-3.5" aria-hidden />
                    {current.state === "ignored" ? "Stop ignoring" : "Ignore"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onReplace(current.id)}
                    disabled={stale || current.suggestion === current.original}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Replace now
                  </Button>
                </div>

                {stale ? (
                  <p className="mt-2 text-2xs leading-relaxed text-warning">
                    The text has changed since this check, so nothing can be applied to it. Run the
                    checker again on the text as it stands.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
                Click an underlined passage in the editor, or a finding above, to read why it was
                flagged.
              </p>
            )}
          </TabsContent>

          <TabsContent value="corrections" className="px-4 py-3">
            {accepted.length === 0 && ignored.length === 0 ? (
              <EmptyState
                compact
                icon={ListChecks}
                title="No decisions yet"
                description="Accepting a finding queues its correction here. Ignoring one keeps your wording and drops it from the queue."
              />
            ) : (
              <>
                <h4 className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Queued corrections
                </h4>
                {accepted.length === 0 ? (
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Nothing is queued. Accept a finding to add its change here.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {accepted.map((issue) => (
                      <li
                        key={issue.id}
                        className="rounded-lg border border-border bg-surface px-3 py-2"
                      >
                        <p className="flex flex-wrap items-baseline gap-2 text-xs">
                          <span className="text-muted-foreground line-through">
                            {issue.original}
                          </span>
                          <span className="font-medium text-success">{issue.suggestion}</span>
                        </p>
                        <p className="mt-1 text-2xs text-muted-foreground">
                          {ISSUE_CATEGORY_LABEL[issue.category]}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 -ml-2"
                          onClick={() => onRestore(issue.id)}
                        >
                          <X className="size-3.5" aria-hidden />
                          Take out of the queue
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onApplyAll}
                    disabled={accepted.length === 0 || stale}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Replace {formatNumber(accepted.length)} in the text
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onClearQueue}
                    disabled={accepted.length === 0}
                  >
                    Clear queue
                  </Button>
                </div>
                {stale && accepted.length > 0 ? (
                  <p className="mt-2 text-2xs leading-relaxed text-warning">
                    The text has changed since this check, so this queue cannot be applied. Check the
                    text again and re-accept what you want changed.
                  </p>
                ) : null}

                {ignored.length > 0 ? (
                  <div className="mt-4 border-t border-border pt-3">
                    <h4 className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Ignored findings
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {ignored.map((issue) => (
                        <li
                          key={issue.id}
                          className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground"
                        >
                          <span className="min-w-0 flex-1 truncate">{issue.original}</span>
                          <span>{ISSUE_CATEGORY_LABEL[issue.category]}</span>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => onRestore(issue.id)}
                          >
                            Bring it back
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="statistics" className="px-4 py-3">
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Words" value={formatNumber(stats.words)} />
              <Stat label="Characters" value={formatNumber(stats.characters)} />
              <Stat label="Sentences" value={formatNumber(stats.sentences)} />
              <Stat label="Paragraphs" value={formatNumber(stats.paragraphs)} />
              <Stat
                label="Average sentence"
                value={`${stats.averageSentenceWords} words`}
                note={`Length varies by about ${stats.sentenceLengthSpread} words.`}
              />
              <Stat
                label="Reading ease"
                value={`${stats.readingEase}`}
                note={`${stats.readingEaseLabel} on the Flesch scale.`}
              />
              <Stat
                label="Vocabulary variety"
                value={`${stats.vocabularyVariety}%`}
                note="Unique words as a share of all words."
              />
              <Stat
                label="Findings per 100 words"
                value={`${stats.issuesPer100Words}`}
                note={`${formatNumber(stats.open)} still open, ${formatNumber(stats.accepted)} queued, ${formatNumber(stats.ignored)} ignored.`}
              />
            </dl>
            <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
              These are counts of this document, measured the same way the rest of the workspace
              measures text. They describe the writing; they do not rate the writer.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold leading-tight tabular">{value}</dd>
      {note ? <dd className="text-2xs leading-relaxed text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

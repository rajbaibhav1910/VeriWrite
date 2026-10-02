import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookText,
  Check,
  Copy,
  Download,
  FileText,
  Globe,
  Info,
  Link2,
  ListOrdered,
  Quote,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { backendConfigured, toServiceError } from "@/lib/api";
import { downloadTextFile, safeFileName } from "@/lib/download";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { formatNumber } from "@/lib/utils";
import { usePreferencesStore } from "@/store/preferencesStore";
import {
  CITATION_EXAMPLES,
  CITATION_FIELD_LABELS,
  CITATION_SOURCE_TYPES,
  CITATION_STYLES,
  DOI_LOOKUP_UNAVAILABLE,
  buildAllStyles,
  createCitation,
  fieldsForSourceType,
  inTextNarrative,
  inTextParenthetical,
  parseDoi,
  resolveFromUrl,
  bibliographyAsText,
  bibliographyFor,
  describeCitationReadiness,
  guardCitationList,
} from "@/services/citationService";
import type { CitationFields } from "@/services/citationService";
import type { Citation, CitationSourceType, CitationStyle, ServiceError } from "@/types";

const FIELD_META = new Map(CITATION_FIELD_LABELS.map((field) => [field.id, field]));

/** The formatter marks italics with asterisks; this turns them back into emphasis. */
function Reference({ text }: { text: string }) {
  const parts = text.split("*");
  return (
    <p className="text-sm leading-relaxed text-foreground">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <em key={index}>{part}</em>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

export function CitationPage() {
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const { toast } = useToast();

  const [sourceType, setSourceType] = useState<CitationSourceType>("journal");
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [fields, setFields] = useState<CitationFields>(() =>
    storeDocuments ? readJson<CitationFields>(STORAGE_KEYS.citationDraft, {}) : {},
  );
  const [list, setList] = useState<Citation[]>(() =>
    storeDocuments ? guardCitationList(readJson<unknown>(STORAGE_KEYS.citations, [])) : [],
  );
  const [urlInput, setUrlInput] = useState("");
  const [doiInput, setDoiInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<ServiceError | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const citation = useMemo(
    () => createCitation({ style, sourceType, fields, number: list.length + 1 }),
    [style, sourceType, fields, list.length],
  );
  const everyStyle = useMemo(
    () => (showAllStyles ? buildAllStyles(sourceType, fields) : []),
    [showAllStyles, sourceType, fields],
  );
  const bibliography = useMemo(() => bibliographyFor(list, style), [list, style]);
  const readiness = describeCitationReadiness(sourceType, fields);
  const hasInput = Object.values(fields).some((value) => (value ?? "").trim().length > 0);

  useEffect(() => {
    if (!storeDocuments) return;
    writeJson(STORAGE_KEYS.citationDraft, fields);
  }, [fields, storeDocuments]);

  useEffect(() => {
    if (!storeDocuments) return;
    writeJson(STORAGE_KEYS.citations, list);
  }, [list, storeDocuments]);

  const setField = useCallback((id: keyof CitationFields, value: string) => {
    setFields((previous) => {
      const next = { ...previous, [id]: value };
      if (!value.trim()) delete next[id];
      return next;
    });
    setNotice(null);
  }, []);

  async function readUrl() {
    const url = urlInput.trim();
    if (!url) {
      setLookupError(null);
      setNotice("Type or paste a web address first.");
      return;
    }
    setResolving(true);
    try {
      const resolved = await resolveFromUrl(url);
      setFields((previous) => ({ ...previous, ...resolved.fields }));
      setNotice(resolved.note);
      setLookupError(null);
    } catch (error) {
      setLookupError(toServiceError(error));
      setNotice(null);
    } finally {
      setResolving(false);
    }
  }

  function useDoi() {
    const raw = doiInput.trim();
    if (!raw) {
      setNotice("Type a DOI first, for example 10.1093/jss/adx118.");
      return;
    }
    const parsed = parseDoi(raw);
    if (!parsed.valid) {
      setLookupError({
        code: "invalid_file",
        message: "That does not read as a DOI.",
        hint: "A DOI starts with 10. followed by a registrant prefix and a suffix, for example 10.1093/jss/adx118.",
      });
      return;
    }
    setFields((previous) => ({ ...previous, doi: parsed.doi, url: parsed.url }));
    setLookupError(backendConfigured() ? null : DOI_LOOKUP_UNAVAILABLE);
    setNotice(`The identifier ${parsed.doi} is in the entry. Its link resolves to ${parsed.url}.`);
  }

  function loadExample() {
    const example = CITATION_EXAMPLES.find((entry) => entry.style === style) ?? CITATION_EXAMPLES[0];
    setSourceType(example.sourceType);
    setFields(example.fields);
    setNotice("Loaded a worked example so you can see what this style produces.");
  }

  function addToBibliography() {
    setList((previous) => [...previous, { ...citation, id: `${citation.id}_${previous.length}` }]);
    toast({
      title: "Added to the bibliography",
      description: `${formatNumber(list.length + 1)} entries kept on this device.`,
    });
  }

  async function copyValue(value: string, label: string) {
    if (!value.trim()) return;
    if (!navigator.clipboard?.writeText) {
      setNotice(`This browser does not let the page write to your clipboard. Select the ${label} and copy it yourself.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "It is on your clipboard." });
    } catch {
      setNotice(`The browser blocked the copy. Select the ${label} and press Ctrl+C (Cmd+C on a Mac).`);
    }
  }

  function downloadBibliography() {
    if (list.length === 0) return;
    const name = safeFileName(`${style}-bibliography`, "bibliography");
    const text = bibliographyAsText(bibliography);
    if (downloadTextFile(`${name}.txt`, text, "text/plain")) {
      setNotice(`Saved ${formatNumber(list.length)} entries as ${name}.txt.`);
    } else {
      setNotice("This browser would not start the download. Copy the list instead.");
    }
  }

  function removeEntry(id: string) {
    setList((previous) => previous.filter((entry) => entry.id !== id));
    setConfirmClear(false);
  }

  return (
    <>
      <PageHeader
        title="Citation Generator"
        description="Describe a source once and read it back in APA, MLA, Chicago, Harvard or IEEE — with the in-text form beside it."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Citations" }]}
        actions={
          <Badge variant="outline" size="sm">
            Built on this device
          </Badge>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          {notice ? (
            <p
              role="status"
              className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground"
            >
              <span className="min-w-0 flex-1">{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss message"
                className="rounded p-0.5 transition-colors hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </p>
          ) : null}

          <Card className="p-4">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">What are you citing?</CardTitle>
            </CardHeader>
            <div className="mt-3 space-y-3">
              <SegmentedControl
                label="Source type"
                size="sm"
                stretched
                value={sourceType}
                onChange={(value) => setSourceType(value)}
                options={CITATION_SOURCE_TYPES.map((type) => ({
                  value: type.id,
                  label: type.label,
                }))}
              />

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <Label htmlFor="citation-url">Start from a web address</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="citation-url"
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      placeholder="https://example.com/report-on-surveys"
                      aria-describedby="citation-url-help"
                    />
                    <Button type="button" variant="secondary" onClick={() => void readUrl()} disabled={resolving}>
                      <Search className="size-3.5" aria-hidden />
                      Read it
                    </Button>
                  </div>
                  <p id="citation-url-help" className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                    Without a reference service this reads the address itself: it can suggest a title
                    and a site name from the link, and says so when it has guessed.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <Label htmlFor="citation-doi">Or a DOI</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="citation-doi"
                      value={doiInput}
                      onChange={(event) => setDoiInput(event.target.value)}
                      placeholder="10.1093/jss/adx118"
                    />
                    <Button type="button" variant="secondary" onClick={useDoi}>
                      <Link2 className="size-3.5" aria-hidden />
                      Use it
                    </Button>
                  </div>
                </div>
              </div>

              {lookupError ? <ErrorState compact error={lookupError} /> : null}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm">Source details</CardTitle>
              <Badge variant={readiness.startsWith("Still missing") ? "warning" : "success"} size="xs">
                {readiness.startsWith("Still missing") ? "Incomplete" : "Complete"}
              </Badge>
              <Button type="button" variant="link" size="sm" className="ml-auto" onClick={loadExample}>
                <Sparkles className="size-3.5" aria-hidden />
                Worked example
              </Button>
            </div>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{readiness}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {fieldsForSourceType(sourceType).map((id) => {
                const meta = FIELD_META.get(id);
                if (!meta) return null;
                return (
                  <div key={id} className={id === "title" || id === "containerTitle" ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`field-${id}`}>{meta.label}</Label>
                    <Input
                      id={`field-${id}`}
                      className="mt-1"
                      value={fields[id] ?? ""}
                      onChange={(event) => setField(id, event.target.value)}
                      placeholder={meta.hint}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={addToBibliography} disabled={!hasInput}>
                <ListOrdered className="size-3.5" aria-hidden />
                Add to bibliography
              </Button>
              <Button type="button" variant="ghost" onClick={() => {
                setFields({});
                setNotice("Cleared the form. The bibliography entries you already added are untouched.");
              }}>
                Clear form
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAllStyles((value) => !value)}>
                {showAllStyles ? "One style" : "Compare all five"}
              </Button>
            </div>
            {!hasInput ? (
              <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
                Fill in at least the title and a year to get an entry worth copying.
              </p>
            ) : null}
          </Card>

          {hasInput ? (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                <CardTitle className="text-sm">Citation</CardTitle>
                <Badge variant="info" size="xs">
                  {CITATION_STYLES.find((entry) => entry.id === style)?.label}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => void copyValue(citation.bibliographyEntry, "reference")}
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copy
                </Button>
              </div>
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Bibliography entry
                  </p>
                  <div className="mt-1 rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
                    <Reference text={citation.bibliographyEntry || citation.formatted} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      In the text (parenthetical)
                    </p>
                    <p className="mt-1 text-sm text-foreground">{inTextParenthetical(citation)}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      In the text (narrative)
                    </p>
                    <p className="mt-1 text-sm text-foreground">{inTextNarrative(citation)}</p>
                  </div>
                </div>
                <p className="flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                  Every entry here is produced by this page from what you typed. It has not been
                  checked against a catalogue, a publisher record or a style manual edition beyond
                  the five rule sets built in.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <EmptyState
                  compact
                  icon={Quote}
                  title="Nothing to format yet"
                  description="Start from a link, a DOI, or type the details yourself. The entry is built as you type, on this device."
                />
              </CardContent>
            </Card>
          )}

          {showAllStyles && hasInput ? (
            <Card className="p-4">
              <CardTitle className="text-sm">The same source in all five styles</CardTitle>
              <ul className="mt-2 space-y-3">
                {everyStyle.map((entry) => (
                  <li key={entry.style} className="rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="subtle" size="xs">
                        {CITATION_STYLES.find((item) => item.id === entry.style)?.label}
                      </Badge>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="ml-auto"
                        onClick={() => void copyValue(entry.bibliographyEntry, "reference")}
                      >
                        <Copy className="size-3.5" aria-hidden />
                        Copy
                      </Button>
                    </div>
                    <div className="mt-1">
                      <Reference text={entry.bibliographyEntry} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm">Bibliography</CardTitle>
              <Badge variant="outline" size="xs">
                {formatNumber(list.length)} {list.length === 1 ? "entry" : "entries"}
              </Badge>
              <div className="ml-auto flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={downloadBibliography} disabled={list.length === 0}>
                  <Download className="size-3.5" aria-hidden />
                  .txt
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyValue(bibliographyAsText(bibliography), "bibliography")}
                  disabled={list.length === 0}
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copy all
                </Button>
                {confirmClear ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setList([]);
                      setConfirmClear(false);
                      setNotice("The bibliography list is empty again.");
                    }}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Confirm delete all
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmClear(true)}
                    disabled={list.length === 0}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              {style === "ieee"
                ? "IEEE numbers entries in the order you cited them."
                : "Sorted by the first author's family name, then by year."}
            </p>

            {bibliography.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-2xs leading-relaxed text-muted-foreground">
                Nothing added yet. Build an entry above and press “Add to bibliography”.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {bibliography.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="group flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2.5"
                  >
                    <span className="mt-0.5 tabular text-2xs text-muted-foreground">
                      {style === "ieee" ? `[${index + 1}]` : `${index + 1}.`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Reference text={entry.bibliographyEntry} />
                      <p className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
                        {entry.sourceType === "book" ? (
                          <BookText className="size-3" aria-hidden />
                        ) : entry.sourceType === "webpage" ? (
                          <Globe className="size-3" aria-hidden />
                        ) : (
                          <FileText className="size-3" aria-hidden />
                        )}
                        {CITATION_SOURCE_TYPES.find((type) => type.id === entry.sourceType)?.label}
                        {" · "}
                        {CITATION_STYLES.find((item) => item.id === entry.style)?.label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      aria-label={`Remove entry ${index + 1}`}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <p className="text-2xs leading-relaxed text-muted-foreground">
            Need a report on an analysis you already ran?{" "}
            <Link to="/reports" className="text-primary underline-offset-2 hover:underline">
              Open Reports
            </Link>
            .
          </p>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <CardTitle className="text-sm">Style</CardTitle>
            <div className="mt-2 space-y-1.5">
              {CITATION_STYLES.map((entry) => {
                const active = entry.id === style;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setStyle(entry.id)}
                    aria-pressed={active}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="block text-sm font-medium">{entry.label}</span>
                    <span className="block text-2xs leading-relaxed">{entry.note}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <CardTitle className="text-sm">How this page works</CardTitle>
            <ul className="mt-2 space-y-1.5 text-2xs leading-relaxed text-muted-foreground">
              <li>The entry is formatted from what you type, on this device, and nothing is looked up for you.</li>
              <li>A missing author is not an error: the title takes its place, the way a hand-built reference does.</li>
              <li>Italics are shown in place and dropped when you copy plain text.</li>
              <li>
                Resolving a DOI against a registry needs the reference service, which this build does
                not connect. Your own details are enough for a complete entry.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  FileUp,
  ListTree,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  TextSelect,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/editor/RichTextEditor";
import { SummaryOutput } from "@/components/summarizer/SummaryOutput";
import { ImportDialog } from "@/components/detector/ImportDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/loader";
import { useToast } from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toServiceError } from "@/lib/api";
import { quotaError, useQuota } from "@/hooks/useQuota";
import { downloadTextFile, safeFileName } from "@/lib/download";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { countWords, splitSentences } from "@/lib/text";
import { MAX_WORDS, formatNumber } from "@/lib/utils";
import { SAMPLE_SUMMARY_SOURCE } from "@/data/sampleDocuments";
import { ACCEPT_ATTRIBUTE, extractTextFromFile } from "@/services/fileService";
import {
  SUMMARY_FORMATS,
  SUMMARY_LENGTH_CHOICES,
  SUMMARY_MIN_WORDS,
  SUMMARIZER_NOTE,
  defaultLength,
  describeSummaryRun,
  getSummarizerStatus,
  summarizeText,
  summaryAsText,
  type SummaryFormat,
} from "@/services/summarizerService";
import { usePreferencesStore } from "@/store/preferencesStore";
import type { AnalysisPhase, ServiceError, StoredDocument, SummaryResult } from "@/types";

type RunState =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase }
  | { status: "done"; result: SummaryResult; sourceText: string }
  | { status: "error"; error: ServiceError };

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Reading the document",
  normalizing: "Splitting into sentences",
  analyzing: "Scoring each sentence",
  scoring: "Dropping the repeats",
  reporting: "Writing the summary",
};

/**
 * The summarizer workspace. It ranks the reader's own sentences and copies the
 * best ones out, so the output is always a subset of the input — this page never
 * generates wording, and the length and format controls only decide how many
 * sentences survive and how they are laid out.
 */
export function SummarizerPage() {
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const { toast } = useToast();
  const guard = useQuota("summarizer");
  const surface = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draftHtml] = useState(() =>
    storeDocuments ? readJson<string>(STORAGE_KEYS.summarizerHtml, "") : "",
  );
  const [content, setContent] = useState({ text: "", html: draftHtml });
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [length, setLength] = useState("auto");
  const [format, setFormat] = useState<SummaryFormat>("paragraph");
  const [notice, setNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<ServiceError | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const lastSaved = useRef(draftHtml);

  useEffect(() => () => abortRef.current?.abort(), []);

  const text = content.text;
  const words = countWords(text);
  const running = run.status === "running";
  const tooShort = words < SUMMARY_MIN_WORDS;
  const tooLong = words > MAX_WORDS;
  const status = getSummarizerStatus();
  const result = run.status === "done" ? run.result : null;
  const sourceText = run.status === "done" ? run.sourceText : null;
  /** The reader kept writing, so this summary describes the older text. */
  const stale = sourceText !== null && sourceText !== text;

  const sentenceCount = useMemo(() => splitSentences(text).length, [text]);
  const budget = length === "auto" ? defaultLength(text) : Number(length);

  // Draft autosave, on the same rule as the detector: an empty editor is not a draft.
  useEffect(() => {
    if (!storeDocuments || content.html === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = content.html;
      writeJson(STORAGE_KEYS.summarizerHtml, content.html);
      setSavedAt(timeLabel());
    }, 700);
    return () => clearTimeout(timer);
  }, [content.html, storeDocuments]);

  function handleContentChange(nextText: string, nextHtml: string) {
    if (nextText.length === 0) {
      setSource(null);
      if (run.status !== "idle") setRun({ status: "idle" });
    }
    setContent({ text: nextText, html: nextText.trim().length === 0 ? "" : nextHtml });
  }

  const check = useCallback(
    async (target: string) => {
      const quota = guard.check(countWords(target));
      if (!quota.allowed) {
        setRun({ status: "error", error: quotaError(quota) });
        toast({
          title: "Run not started",
          description: quota.reason ?? "That run is over your plan's limit.",
          variant: "warning",
        });
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setFileError(null);
      setRun({ status: "running", phase: "preparing" });

      try {
        const next = await summarizeText(target, {
          length: length === "auto" ? undefined : Number(length),
          format,
          signal: controller.signal,
          onPhase: (phase) => {
            if (abortRef.current === controller) setRun({ status: "running", phase });
          },
        });
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        setRun({ status: "done", result: next, sourceText: target });
        guard.record(countWords(target));

        setNotice(null);
        toast({
          title: "Summary ready",
          description: describeSummaryRun(next, target),
          variant: "success",
        });
      } catch (error) {
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        const serviceError = toServiceError(error);
        setRun({ status: "error", error: serviceError });
        toast({ title: "Summary stopped", description: serviceError.message, variant: "error" });
      }
    },
    [format, length, guard, toast],
  );

  function start() {
    void check(text);
  }

  function cancel() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setRun({ status: "idle" });
    setNotice("Summary cancelled. Your text is still here.");
  }

  useKeyboardShortcuts({ onAnalyze: start, enabled: !running && !tooShort && !tooLong });

  async function copySummary() {
    if (!result) return;
    if (!navigator.clipboard?.writeText) {
      setNotice(
        "This browser does not let the page write to your clipboard. Select the summary and copy it yourself.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(summaryAsText(result));
      toast({
        title: "Summary copied",
        description: "Summary, key findings and keywords are on your clipboard.",
      });
    } catch {
      setNotice("The browser blocked the copy. Select the summary and press Ctrl+C (Cmd+C on a Mac).");
    }
  }

  function downloadSummary() {
    if (!result) return;
    const name = safeFileName(source ?? "document", "document");
    const written = downloadTextFile(
      `${name}-summary.txt`,
      `${summaryAsText(result)}\n\nSource text: ${result.format} summary by VeriWrite.\n`,
      "text/plain",
    );
    setNotice(
      written
        ? `Saved as ${name}-summary.txt.`
        : "This browser will not let the page start a download. Copy the summary instead.",
    );
  }

  function loadExample() {
    surface.current?.loadText(SAMPLE_SUMMARY_SOURCE);
    setSource("example: the coral reef article");
    setRun({ status: "idle" });
    setFileError(null);
    setNotice(null);
  }

  function importDocument(document: StoredDocument) {
    surface.current?.loadText(document.text);
    setSource(`imported: ${document.title}`);
    setRun({ status: "idle" });
    setNotice(null);
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setNotice(
        "This browser does not let the page read your clipboard. Click in the editor and press Ctrl+V (Cmd+V on a Mac).",
      );
      return;
    }
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim().length === 0) {
        setNotice("Your clipboard has no text in it.");
        return;
      }
      surface.current?.insertText(clip);
      setSource("pasted text");
      setNotice(null);
    } catch {
      setNotice(
        "The browser blocked clipboard access. Click in the editor and press Ctrl+V (Cmd+V on a Mac) instead.",
      );
    }
  }

  async function loadFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (files.length > 1) setNotice(`Several files were dropped; only ${file.name} was loaded.`);
    const outcome = await extractTextFromFile(file);
    if (outcome.status === "error") {
      setFileError(outcome.error);
      return;
    }
    setFileError(null);
    surface.current?.loadText(outcome.file.text);
    setSource(
      outcome.file.source === "browser"
        ? `${outcome.file.filename}`
        : `${outcome.file.filename} via the document service`,
    );
    setRun({ status: "idle" });
    toast({
      title: `${outcome.file.filename} loaded`,
      description: `${formatNumber(outcome.file.characters)} characters read from the file.`,
      variant: "success",
    });
  }

  return (
    <>
      <PageHeader
        title="Summarizer"
        description="Condense an article or document into a paragraph, a bullet summary or key points — using its own sentences."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Summarizer" }]}
        actions={
          <>
            <Badge variant="outline" size="sm">
              {status.engine === "local" ? "Extractive · this device" : "Text service"}
            </Badge>
            <Button asChild variant="subtle" size="sm">
              <Link to="/detector">
                <Wand2 className="size-3.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">AI Detector</span>
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          {fileError ? (
            <div className="flex items-start gap-3 rounded-lg border border-error/30 bg-error-soft px-4 py-3">
              <Upload className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-error">{fileError.message}</p>
                {fileError.hint ? (
                  <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                    {fileError.hint}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setFileError(null)}
                aria-label="Dismiss file message"
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="flex items-start gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground"
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

          <RichTextEditor
            ref={surface}
            initialHtml={draftHtml}
            onChange={handleContentChange}
            onPaste={() => void pasteFromClipboard()}
            onUpload={() => fileInputRef.current?.click()}
            onImport={() => setImportOpen(true)}
            onFiles={(files) => void loadFiles(files)}
            minWords={SUMMARY_MIN_WORDS}
            maxWords={MAX_WORDS}
            ariaLabel="Document to summarise"
            savedAt={savedAt}
            status={
              source ? (
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3" aria-hidden />
                  {source}
                </span>
              ) : null
            }
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length > 0) void loadFiles(files);
            }}
          />

          {result && sourceText ? (
            <SummaryOutput
              result={result}
              sourceText={sourceText}
              stale={stale}
              onCopy={() => void copySummary()}
              onDownload={downloadSummary}
            />
          ) : null}

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-2xs leading-relaxed text-muted-foreground">{SUMMARIZER_NOTE}</p>
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <div className="space-y-2">
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={start}
                disabled={running || tooShort || tooLong}
              >
                {running ? <Spinner size="sm" /> : <TextSelect className="size-4" aria-hidden />}
                {running ? `${PHASE_LABEL[run.phase]}…` : "Summarize"}
              </Button>

              {running ? (
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={cancel}>
                  <Square className="size-3.5" aria-hidden />
                  Cancel summary
                </Button>
              ) : null}

              {result && !running ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={start}
                  disabled={tooShort || tooLong}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Summarize again with these settings
                </Button>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={loadExample}
                disabled={running}
              >
                <Sparkles className="size-3.5" aria-hidden />
                Load the sample article
              </Button>

              <p className="text-2xs leading-relaxed text-muted-foreground">
                {tooShort ? (
                  <>
                    Needs at least {SUMMARY_MIN_WORDS} words to rank sentences in. This has{" "}
                    {formatNumber(words)}.
                  </>
                ) : tooLong ? (
                  <>
                    {formatNumber(words - MAX_WORDS)} words over the {formatNumber(MAX_WORDS)} word
                    limit. Summarise a document a section at a time.
                  </>
                ) : running ? (
                  `${PHASE_LABEL[run.phase]}.`
                ) : (
                  <>
                    Ready · {formatNumber(words)} words in {formatNumber(sentenceCount)} sentences.
                    Ctrl+Enter (Cmd+Enter) runs it.
                  </>
                )}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="summarizer-length">Summary length</Label>
                <Select
                  id="summarizer-length"
                  className="mt-1"
                  value={length}
                  onChange={(event) => setLength(event.target.value)}
                >
                  <option value="auto">
                    Auto — {formatNumber(defaultLength(text))} sentences for this text
                  </option>
                  {SUMMARY_LENGTH_CHOICES.map((choice) => (
                    <option key={choice.sentences} value={String(choice.sentences)}>
                      {choice.label} — {choice.sentences} sentence
                      {choice.sentences === 1 ? "" : "s"}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                  {sentenceCount === 0 ? (
                    "Write or import something first."
                  ) : budget > sentenceCount ? (
                    <>
                      A budget of {formatNumber(budget)} sentences cannot be filled — this document
                      has {formatNumber(sentenceCount)}, so the summary keeps all of them and the
                      compression figure will read high.
                    </>
                  ) : (
                    <>
                      Keeps at most {formatNumber(budget)} of {formatNumber(sentenceCount)}{" "}
                      sentences, skipping any that only repeat one already kept.
                    </>
                  )}
                </p>
              </div>

              <div>
                <Label>Format</Label>
                <SegmentedControl
                  className="mt-1 w-full"
                  size="sm"
                  stretched
                  label="Summary format"
                  value={format}
                  onChange={(value) => setFormat(value as SummaryFormat)}
                  options={SUMMARY_FORMATS.map((entry) => ({
                    value: entry.id,
                    label: entry.id === "key-points" ? "Key points" : entry.label,
                  }))}
                />
                <p className="mt-1 flex gap-1.5 text-2xs leading-relaxed text-muted-foreground">
                  <ListTree className="mt-px size-3.5 shrink-0" aria-hidden />
                  {SUMMARY_FORMATS.find((entry) => entry.id === format)?.note}
                </p>
              </div>

              <p className="text-2xs leading-relaxed text-muted-foreground">{status.scope}</p>
            </div>
          </Card>

          {stale ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
              <FileUp className="mt-px size-4 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  The summary was made from the text as it was before your latest edits. Nothing on
                  this page rewrites your document.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={start} disabled={running}>
                  Summarize this text again
                </Button>
              </div>
            </div>
          ) : null}

          {run.status === "error" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <ErrorState compact error={run.error} onRetry={start} retryLabel="Summarize again" />
              </CardContent>
            </Card>
          ) : null}

          {!result && run.status !== "error" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <EmptyState
                  compact
                  icon={TextSelect}
                  title="Nothing summarized yet"
                  description="Sentences are scored by how much of the document's wording they carry, with a nudge for leading sentences and a gate that drops repeats."
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={loadExample}>
                      <Sparkles className="size-3.5" aria-hidden />
                      Load the sample
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onPick={importDocument} />
    </>
  );
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

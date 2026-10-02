import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  FileSearch,
  FileText,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/editor/RichTextEditor";
import { PlagiarismResults } from "@/components/plagiarism/PlagiarismResults";
import { SourcePanel, type PlagiarismTab } from "@/components/plagiarism/SourcePanel";
import { MatchHoverCard } from "@/components/plagiarism/MatchHoverCard";
import { ImportDialog } from "@/components/detector/ImportDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/loader";
import { useToast } from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toServiceError } from "@/lib/api";
import { quotaError, useQuota } from "@/hooks/useQuota";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { countWords } from "@/lib/text";
import { MAX_WORDS, formatNumber } from "@/lib/utils";
import { SAMPLE_PLAGIARISM_TEXT } from "@/data/plagiarismCorpus";
import { ACCEPT_ATTRIBUTE, extractTextFromFile } from "@/services/fileService";
import {
  PLAGIARISM_MIN_WORDS,
  getPlagiarismStatus,
  scanForMatches,
  type PlagiarismRun,
} from "@/services/plagiarismService";
import { usePreferencesStore } from "@/store/preferencesStore";
import type { AnalysisPhase, ServiceError, StoredDocument } from "@/types";

type RunState =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase }
  | { status: "done"; scan: PlagiarismRun; scannedText: string }
  | { status: "error"; error: ServiceError };

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Reading the text",
  normalizing: "Cleaning the spacing",
  analyzing: "Comparing against the corpus",
  scoring: "Counting the overlap",
  reporting: "Preparing the source list",
};

/**
 * The plagiarism workspace. It runs a real comparison against the corpus the
 * service reports — bundled demo passages when no similarity index is attached —
 * and paints the spans the scanner itself located. Nothing here claims a web scan:
 * the engine label, the corpus count and the notice all come from the run.
 */
export function PlagiarismPage() {
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const { toast } = useToast();
  const guard = useQuota("plagiarism");
  const surface = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draftHtml] = useState(() =>
    storeDocuments ? readJson<string>(STORAGE_KEYS.plagiarismHtml, "") : "",
  );
  const [content, setContent] = useState({ text: "", html: draftHtml });
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [tab, setTab] = useState<PlagiarismTab>("sources");
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
  const tooLong = words > MAX_WORDS;
  const status = getPlagiarismStatus();

  const scan = run.status === "done" ? run.scan : null;
  const scannedText = run.status === "done" ? run.scannedText : null;
  /** The reader edited after the scan, so no span points at the text any more. */
  const stale = scannedText !== null && scannedText !== text;

  const spans = useMemo(
    () =>
      scan
        ? scan.matches.map((match) => ({
            id: match.id,
            start: match.start,
            end: match.end,
            kind: match.kind,
          }))
        : [],
    [scan],
  );

  // Draft autosave, on the same rule as the detector: an empty editor is not a draft.
  useEffect(() => {
    if (!storeDocuments || content.html === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = content.html;
      writeJson(STORAGE_KEYS.plagiarismHtml, content.html);
      setSavedAt(timeLabel());
    }, 700);
    return () => clearTimeout(timer);
  }, [content.html, storeDocuments]);

  // A new scan describes different passages, so an open one must not linger on them.
  useEffect(() => {
    setSelectedMatch(null);
    setHovered(null);
  }, [scannedText]);

  // Stepping to a passage keeps it on screen.
  useEffect(() => {
    if (!selectedMatch) return;
    const element = document.querySelector<HTMLElement>(`[data-match="${selectedMatch}"]`);
    element?.scrollIntoView({ block: "center" });
  }, [selectedMatch]);

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
        const result = await scanForMatches(target, {
          signal: controller.signal,
          onPhase: (phase) => {
            if (abortRef.current === controller) setRun({ status: "running", phase });
          },
        });
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        setRun({ status: "done", scan: result, scannedText: target });
        guard.record(countWords(target));

        setNotice(null);
        toast({
          title:
            result.matches.length === 0
              ? "No passage matched"
              : `${formatNumber(result.matches.length)} matched passages`,
          description:
            result.matches.length === 0
              ? `Nothing in the ${result.engine === "demo-corpus" ? "demo corpus" : "index it searched"} shared words with this text. That is not a finding of originality.`
              : "Open a source card to read the passage it matched and where it came from.",
          variant: result.matches.length === 0 ? "info" : "warning",
        });
      } catch (error) {
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        const serviceError = toServiceError(error);
        setRun({ status: "error", error: serviceError });
        toast({ title: "Scan stopped", description: serviceError.message, variant: "error" });
      }
    },
    [guard, toast],
  );

  function start() {
    void check(text);
  }

  function cancel() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setRun({ status: "idle" });
    setNotice("Scan cancelled. Your text is still here.");
  }

  useKeyboardShortcuts({
    onAnalyze: start,
    enabled: !running && words >= PLAGIARISM_MIN_WORDS && !tooLong,
  });

  function loadExample() {
    surface.current?.loadText(SAMPLE_PLAGIARISM_TEXT);
    setSource("example: text with passages the demo corpus holds");
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

  const hoveredMatch = hovered ? scan?.matches.find((match) => match.id === hovered.id) ?? null : null;

  return (
    <>
      <PageHeader
        title="Plagiarism Checker"
        description="Compare your draft against a body of text, read the passages that overlap, and see which source each one came from."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Plagiarism" }]}
        actions={
          <>
            <Badge variant="outline" size="sm">
              {status.engine === "demo-corpus"
                ? `Demo corpus · ${formatNumber(status.corpusSize)} passages`
                : "Similarity service"}
            </Badge>
            <Button asChild variant="subtle" size="sm">
              <Link to="/grammar">
                <Wand2 className="size-3.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">Grammar</span>
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
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
            minWords={PLAGIARISM_MIN_WORDS}
            maxWords={MAX_WORDS}
            ariaLabel="Text to scan for matched sources"
            savedAt={savedAt}
            matches={scannedText ? { spans, scannedText } : null}
            selectedMatch={selectedMatch}
            onMatchSelect={setSelectedMatch}
            onMatchHover={setHovered}
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

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-2xs leading-relaxed text-muted-foreground">{status.scope}</p>
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
                disabled={running || words < PLAGIARISM_MIN_WORDS || tooLong}
              >
                {running ? <Spinner size="sm" /> : <FileSearch className="size-4" aria-hidden />}
                {running ? `${PHASE_LABEL[run.phase]}…` : "Scan for sources"}
              </Button>

              {running ? (
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={cancel}>
                  <Square className="size-3.5" aria-hidden />
                  Cancel scan
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
                Load a text with copied passages
              </Button>

              <p className="text-2xs leading-relaxed text-muted-foreground">
                {words < PLAGIARISM_MIN_WORDS ? (
                  <>Type or import something to scan.</>
                ) : tooLong ? (
                  <>
                    {formatNumber(words - MAX_WORDS)} words over the {formatNumber(MAX_WORDS)} word
                    limit. Scan a document a section at a time.
                  </>
                ) : running ? (
                  `${PHASE_LABEL[run.phase]}.`
                ) : (
                  <>
                    Ready · {formatNumber(words)} words. Ctrl+Enter (Cmd+Enter) runs the scan
                    against{" "}
                    {status.engine === "demo-corpus"
                      ? `${formatNumber(status.corpusSize)} bundled passages.`
                      : "the connected similarity index."}
                  </>
                )}
              </p>
            </div>
          </Card>

          {stale ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
              <AlertTriangle className="mt-px size-4 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  You have edited the text since this scan, so the{" "}
                  {formatNumber(scan?.matches.length ?? 0)} matched passages no longer point at it.
                  The marks are gone rather than sitting on the wrong words.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={start} disabled={running}>
                  Scan this text again
                </Button>
              </div>
            </div>
          ) : null}

          {scan ? (
            <>
              <PlagiarismResults scan={scan} />
              <SourcePanel
                scan={scan}
                tab={tab}
                onTabChange={setTab}
                selectedMatch={selectedMatch}
                onSelectMatch={setSelectedMatch}
                stale={stale}
              />
            </>
          ) : run.status === "error" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <ErrorState compact error={run.error} onRetry={start} retryLabel="Scan again" />
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <EmptyState
                  compact
                  icon={FileSearch}
                  title="Nothing scanned yet"
                  description={
                    status.engine === "demo-corpus"
                      ? `${formatNumber(status.corpusSize)} passages are compared in this browser — shared word runs and reworded sentences. Your text does not leave the page.`
                      : "The scan goes through the similarity service this app is connected to."
                  }
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={loadExample}>
                      <Sparkles className="size-3.5" aria-hidden />
                      Load the sample
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onPick={importDocument} />

      {hoveredMatch && hovered ? (
        <MatchHoverCard match={hoveredMatch} rect={hovered.rect} />
      ) : null}
    </>
  );
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  ShieldCheck,
  Sparkles,
  SpellCheck,
  Square,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/editor/RichTextEditor";
import { GrammarSidePanel, type GrammarTab } from "@/components/grammar/GrammarSidePanel";
import { IssueHoverCard } from "@/components/grammar/IssueHoverCard";
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
import { describeWriting } from "@/lib/tools/writingStats";
import { SAMPLE_GRAMMAR_TEXT } from "@/data/sampleDocuments";
import { ACCEPT_ATTRIBUTE, extractTextFromFile } from "@/services/fileService";
import {
  GRAMMAR_CATEGORIES,
  GRAMMAR_ENGINE_INFO,
  GRAMMAR_MIN_WORDS,
  GRAMMAR_NOTE,
  applyGrammarFixes,
  checkGrammarText,
} from "@/services/grammarService";
import { usePreferencesStore } from "@/store/preferencesStore";
import type { AnalysisPhase, GrammarIssue, IssueCategory, ServiceError, StoredDocument } from "@/types";

type RunState =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase }
  | { status: "done"; issues: GrammarIssue[]; checkedText: string; wordsChecked: number }
  | { status: "error"; error: ServiceError };

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Reading the text",
  normalizing: "Cleaning the spacing",
  analyzing: "Running the rules",
  scoring: "Ordering the findings",
  reporting: "Preparing the report",
};

/**
 * The grammar workspace. The checker reports ranges in the text it read; this page
 * holds the reader's decisions about those ranges (open, queued, ignored) and is the
 * only thing that writes into the document, through the editor's traced replacement.
 */
export function GrammarPage() {
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const { toast } = useToast();
  const guard = useQuota("grammar");
  const surface = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draftHtml] = useState(() =>
    storeDocuments ? readJson<string>(STORAGE_KEYS.grammarHtml, "") : "",
  );
  const [content, setContent] = useState({ text: "", html: draftHtml });
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory[]>([]);
  const [tab, setTab] = useState<GrammarTab>("issues");
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

  const issues = run.status === "done" ? run.issues : [];
  const checkedText = run.status === "done" ? run.checkedText : null;
  /** The reader edited after the check, so no range can be trusted. */
  const stale = checkedText !== null && checkedText !== text;

  const visible = useMemo(
    () =>
      categoryFilter.length === 0
        ? issues
        : issues.filter((issue) => categoryFilter.includes(issue.category)),
    [issues, categoryFilter],
  );
  const accepted = useMemo(
    () => issues.filter((issue) => issue.state === "accepted"),
    [issues],
  );
  const ignored = useMemo(() => issues.filter((issue) => issue.state === "ignored"), [issues]);
  const stats = useMemo(() => describeWriting(text, issues), [text, issues]);

  // Draft autosave, on the same rule as the detector: an empty editor is not a draft.
  useEffect(() => {
    if (!storeDocuments || content.html === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = content.html;
      writeJson(STORAGE_KEYS.grammarHtml, content.html);
      setSavedAt(timeLabel());
    }, 700);
    return () => clearTimeout(timer);
  }, [content.html, storeDocuments]);

  // A new run describes different findings, so an open one must not linger on them.
  useEffect(() => {
    setSelectedId(null);
    setHovered(null);
  }, [checkedText]);

  // Stepping to a finding keeps the passage on screen.
  useEffect(() => {
    if (!selectedId) return;
    const element = document.querySelector<HTMLElement>(`[data-issue="${selectedId}"]`);
    element?.scrollIntoView({ block: "center" });
  }, [selectedId]);

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
        const report = await checkGrammarText(target, {
          signal: controller.signal,
          categories: categoryFilter.length === 0 ? undefined : categoryFilter,
          onPhase: (phase) => {
            if (abortRef.current === controller) setRun({ status: "running", phase });
          },
        });
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        setRun({ status: "done", issues: report.issues, checkedText: target, wordsChecked: report.wordsChecked });
        guard.record(report.wordsChecked);

        setNotice(null);
        toast({
          title: report.issues.length === 0 ? "No rule matched" : `${report.issues.length} findings`,
          description:
            report.issues.length === 0
              ? "Nothing matched the rules. That is not a guarantee the text is correct."
              : "Open a highlighted passage to read why each one was flagged.",
          variant: report.issues.length === 0 ? "info" : "success",
        });
      } catch (error) {
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        const serviceError = toServiceError(error);
        setRun({ status: "error", error: serviceError });
        toast({ title: "Check stopped", description: serviceError.message, variant: "error" });
      }
    },
    [categoryFilter, guard, toast],
  );

  function start() {
    void check(text);
  }

  function cancel() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setRun({ status: "idle" });
    setNotice("Check cancelled. Your text is still here.");
  }

  useKeyboardShortcuts({ onAnalyze: start, enabled: !running && words >= GRAMMAR_MIN_WORDS && !tooLong });

  function decide(id: string, state: GrammarIssue["state"]) {
    setRun((current) =>
      current.status === "done"
        ? { ...current, issues: current.issues.map((issue) => (issue.id === id ? { ...issue, state } : issue)) }
        : current,
    );
  }

  /**
   * Writes the chosen findings into the document through the editor's traced
   * replacement, then checks the text that results. The checker is the only route
   * to new findings, so a run's list can never claim a correction it did not report.
   */
  async function applyCorrections(chosen: GrammarIssue[], label: string) {
    if (!checkedText || chosen.length === 0) return;
    // Asking to replace a finding overrides an earlier ignore: the editor writes
    // every chosen span, so the text we re-check must be derived the same way.
    const applicable = chosen
      .filter((issue) => issue.suggestion !== issue.original)
      .map((issue) => ({ ...issue, state: "open" as const }));
    if (applicable.length === 0) {
      setNotice("None of these findings offered a replacement to write in.");
      return;
    }

    const written = surface.current?.replaceRanges(
      applicable.map((issue) => ({
        start: issue.start,
        end: issue.end,
        original: issue.original,
        text: issue.suggestion,
      })),
    );
    if (!written) {
      setNotice(
        "At least one of those passages is no longer where the checker found it, so nothing was changed. Run the check again.",
      );
      return;
    }

    const nextText = applyGrammarFixes(checkedText, applicable);
    const skipped = chosen.length - applicable.length;
    // The re-check clears notices, so this one is set after it settles.
    await check(nextText);
    setNotice(
      `${formatNumber(applicable.length)} correction${applicable.length === 1 ? "" : "s"} written into the text (${label}).` +
        (skipped > 0 ? ` ${formatNumber(skipped)} finding${skipped === 1 ? "" : "s"} offered advice only and were left as they were.` : "") +
        " Press Ctrl+Z to undo.",
    );
  }

  function loadExample() {
    surface.current?.loadText(SAMPLE_GRAMMAR_TEXT);
    setSource("example: the passage the checker is built to catch");
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

  function toggleCategory(category: IssueCategory) {
    setCategoryFilter((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    );
  }

  const hoveredIssue = hovered ? issues.find((issue) => issue.id === hovered.id) ?? null : null;

  return (
    <>
      <PageHeader
        title="Grammar Checker"
        description="Check spelling, grammar, punctuation and clarity in your draft, and read why each passage was flagged."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Grammar" }]}
        actions={
          <>
            <Badge variant="outline" size="sm">
              {GRAMMAR_ENGINE_INFO.ruleCount} rules ·{" "}
              {GRAMMAR_ENGINE_INFO.runsLocally ? "this device" : "document service"}
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
            minWords={GRAMMAR_MIN_WORDS}
            maxWords={MAX_WORDS}
            ariaLabel="Text to check for grammar"
            savedAt={savedAt}
            issues={checkedText ? { issues: visible, checkedText } : null}
            selectedIssue={selectedId}
            onIssueSelect={setSelectedId}
            onIssueHover={setHovered}
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
            <p className="text-2xs leading-relaxed text-muted-foreground">{GRAMMAR_NOTE}</p>
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
                disabled={running || words < GRAMMAR_MIN_WORDS || tooLong}
              >
                {running ? <Spinner size="sm" /> : <SpellCheck className="size-4" aria-hidden />}
                {running ? `${PHASE_LABEL[run.phase]}…` : "Check grammar"}
              </Button>

              {running ? (
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={cancel}>
                  <Square className="size-3.5" aria-hidden />
                  Cancel check
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
                Load a text with planted mistakes
              </Button>

              <p className="text-2xs leading-relaxed text-muted-foreground">
                {words < GRAMMAR_MIN_WORDS ? (
                  <>Type or import something to check.</>
                ) : tooLong ? (
                  <>
                    {formatNumber(words - MAX_WORDS)} words over the {formatNumber(MAX_WORDS)} word
                    limit. Work through a document a section at a time.
                  </>
                ) : running ? (
                  `${PHASE_LABEL[run.phase]}.`
                ) : (
                  <>
                    Ready · {formatNumber(words)} words. Ctrl+Enter (Cmd+Enter) runs the check
                    {" "}
                    {categoryFilter.length > 0
                      ? `on ${categoryFilter.map((category) => category).join(", ")}.`
                      : "on every category."}
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
                  You have edited the text since this check, so the {formatNumber(issues.length)}{" "}
                  findings and any queued corrections no longer point at it. Nothing will be applied
                  to the wrong words.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={start} disabled={running}>
                  Check this text again
                </Button>
              </div>
            </div>
          ) : null}

          {run.status === "done" ? (
            <GrammarSidePanel
              issues={issues}
              visible={visible}
              tab={tab}
              onTabChange={setTab}
              selectedId={selectedId}
              onSelect={setSelectedId}
              accepted={accepted}
              ignored={ignored}
              onAccept={(id) => decide(id, "accepted")}
              onIgnore={(id) => decide(id, "ignored")}
              onRestore={(id) => decide(id, "open")}
              onReplace={(id) => {
                const issue = issues.find((entry) => entry.id === id);
                if (issue) void applyCorrections([issue], "one finding");
              }}
              onApplyAll={() => void applyCorrections(accepted, "from the queue")}
              onClearQueue={() => {
                accepted.forEach((issue) => decide(issue.id, "open"));
                setNotice("Corrections queue cleared. Your text has not changed.");
              }}
              categoryFilter={categoryFilter}
              onToggleCategory={toggleCategory}
              stats={stats}
              stale={stale}
            />
          ) : run.status === "error" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <ErrorState compact error={run.error} onRetry={start} retryLabel="Check again" />
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <EmptyState
                  compact
                  icon={SpellCheck}
                  title="Nothing checked yet"
                  description={
                    GRAMMAR_ENGINE_INFO.runsLocally
                      ? `${GRAMMAR_ENGINE_INFO.ruleCount} rules over ${GRAMMAR_CATEGORIES.join(", ")} run in this browser. Your text does not leave the page.`
                      : `${GRAMMAR_ENGINE_INFO.ruleCount} rules over ${GRAMMAR_CATEGORIES.join(", ")} run through the attached document service.`
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

      {hoveredIssue && hovered ? (
        <IssueHoverCard issue={hoveredIssue} rect={hovered.rect} />
      ) : null}
    </>
  );
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

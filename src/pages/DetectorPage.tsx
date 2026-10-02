import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CircleCheck,
  FileText,
  Gauge,
  HelpCircle,
  History,
  Info,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AssistantDock } from "@/components/assistant/AssistantPanel";
import { RichTextEditor, type HighlightStatus, type RichTextEditorHandle } from "@/components/editor/RichTextEditor";
import { AnalysisProgress, analyzeButtonLabel } from "@/components/detector/AnalysisProgress";
import { DetectionResultDashboard } from "@/components/detector/DetectionResultDashboard";
import { ReportActionBar } from "@/components/report/ReportActionBar";
import { SentenceHoverCard } from "@/components/detector/SentenceHoverCard";
import { SentenceInspector } from "@/components/detector/SentenceInspector";
import { AnalyticsPanel } from "@/components/charts/AnalyticsPanel";
import { buildAnalytics } from "@/lib/detection/analytics";
import { ImportDialog } from "@/components/detector/ImportDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/loader";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { quotaError, useQuota } from "@/hooks/useQuota";
import { useToast } from "@/components/ui/toast";
import { toServiceError } from "@/lib/api";
import { type SentenceFilter } from "@/lib/detection/filters";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { countWords, titleFromText } from "@/lib/text";
import { DETECTION_DISCLAIMER_SHORT, MAX_WORDS, MIN_WORDS, formatNumber } from "@/lib/utils";
import { DETECTOR_LANGUAGE_CHOICES } from "@/config/languages";
import { SAMPLE_DOCUMENTS } from "@/data/sampleDocuments";
import { extractTextFromFile, ACCEPT_ATTRIBUTE } from "@/services/fileService";
import { DETECTION_DISCLAIMER, detectText, getDetectorCapabilities } from "@/services/detectorService";
import {
  getLibraryCapabilities,
  loadAnalysisRecord,
  loadDocument,
  putAnalysis,
  putDocumentText,
} from "@/services/documentService";
import { holdReport, reportFromEntry, reportFromRun } from "@/services/reportService";
import { usePreferencesStore } from "@/store/preferencesStore";
import type { AnalysisPhase, DetectionResult, LanguageCode, ServiceError, StoredDocument } from "@/types";

type RunState =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase }
  | { status: "done"; result: DetectionResult; analysedText: string }
  | { status: "error"; error: ServiceError };

const AUTO = "auto";
type LanguageChoice = LanguageCode | typeof AUTO;

export function DetectorPage() {
  const capabilities = getDetectorCapabilities();
  // Where a saved analysis will actually sit, so the save button never claims the device
  // holds something a service holds.
  const librarySource = getLibraryCapabilities();
  const guard = useQuota("detector");
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const [draftHtml] = useState(() =>
    storeDocuments ? readJson<string>(STORAGE_KEYS.draftHtml, "") : "",
  );
  const surface = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState({ text: "", html: draftHtml });
  const { toast } = useToast();

  const [language, setLanguage] = useState<LanguageChoice>(AUTO);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<ServiceError | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // A document opened from the library: edits autosave back to it, so the footer can
  // honestly say the writing itself is stored rather than only the local draft.
  const [openDoc, setOpenDoc] = useState<{ id: string; title: string } | null>(null);
  const [savedDocAt, setSavedDocAt] = useState<string | null>(null);
  // Why the last autosave did not land, in the words the service or the store gave.
  const [docSaveError, setDocSaveError] = useState<string | null>(null);
  const lastDocText = useRef<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Sentence workspace state. The highlights themselves live in the editor; these
  // decide which of them are painted and which one is open.
  const [sentenceFilter, setSentenceFilter] = useState<SentenceFilter>("all");
  const [selectedSentence, setSelectedSentence] = useState<number | null>(null);
  // What the result shows is a stored preference, so the settings page can change it too.
  const showSentenceScores = usePreferencesStore((state) => state.showSentenceScores);
  const showConfidence = usePreferencesStore((state) => state.showConfidence);
  const showExplanations = usePreferencesStore((state) => state.showExplanations);
  const updatePreferences = usePreferencesStore((state) => state.update);
  const [hovered, setHovered] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [highlightStatus, setHighlightStatus] = useState<HighlightStatus | null>(null);
  const editorCardRef = useRef<HTMLDivElement>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sampleIndex = useRef(0);
  // The document the draft storage already holds, so the editor's first report of it
  // is not mistaken for an edit and saved a second time.
  const lastSaved = useRef(draftHtml);

  useEffect(() => () => abortRef.current?.abort(), []);

  const text = content.text;
  const words = countWords(text);
  const tooShort = words < MIN_WORDS;
  const tooLong = words > MAX_WORDS;
  const running = run.status === "running";

  const result = run.status === "done" ? run.result : null;
  const analysis = useMemo(
    () =>
      run.status === "done"
        ? { sentences: run.result.sentences, analysedText: run.analysedText }
        : null,
    [run],
  );
  const analysisId = result?.analysisId ?? null;
  const analytics = useMemo(() => (result ? buildAnalytics(result) : null), [result]);

  /**
   * The run as a report. Once the analysis is saved the report is rebuilt from that
   * stored row, so the two can never show different figures; before that it is built
   * from the run and the text it measured.
   */
  const reportSource = useMemo(() => {
    if (run.status !== "done") return null;
    if (savedEntryId) {
      // The stored row first, so the two screens cannot show different figures. When the
      // row sits on a service this build has not read back, the run just saved is the
      // same measurement, so it is used rather than showing no report at all.
      return (
        reportFromEntry(savedEntryId) ??
        reportFromRun(run.result, {
          title: openDoc?.title ?? titleFromText(run.analysedText),
          text: run.analysedText,
          documentId: openDoc?.id ?? null,
        })
      );
    }
    return reportFromRun(run.result, {
      title: openDoc?.title ?? titleFromText(run.analysedText),
      text: run.analysedText,
      documentId: openDoc?.id ?? null,
    });
  }, [run, savedEntryId, openDoc]);

  // So the report page can show this report without the address naming anything.
  useEffect(() => {
    if (reportSource) holdReport(reportSource);
    else holdReport(null);
  }, [reportSource]);

  const hoveredSentence =
    hovered && result ? result.sentences.find((sentence) => sentence.index === hovered.index) ?? null : null;

  // A fresh result describes different text, so an open sentence must not linger on it.
  useEffect(() => {
    setSelectedSentence(null);
    setHovered(null);
    setSavedEntryId(null);
  }, [analysisId]);

  // Stepping to a sentence keeps it on screen.
  useEffect(() => {
    if (selectedSentence === null) return;
    const element = editorCardRef.current?.querySelector<HTMLElement>(
      `[data-sentence="${selectedSentence}"]`,
    );
    element?.scrollIntoView({ block: "center" });
  }, [selectedSentence]);

  function handleContentChange(nextText: string, nextHtml: string) {
    // An editor with nothing typed in it is not a draft worth storing, has no
    // provenance to name, and has no text for a result to describe.
    if (nextText.length === 0) {
      setSource(null);
      const controller = abortRef.current;
      if (controller) {
        abortRef.current = null;
        controller.abort();
      }
      if (run.status !== "idle") setRun({ status: "idle" });
    }
    setContent({ text: nextText, html: nextText.trim().length === 0 ? "" : nextHtml });
  }

  // Draft autosave: the document is the user's work, so it is written on a short
  // delay and never while storage is switched off in preferences.
  useEffect(() => {
    if (!storeDocuments || content.html === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = content.html;
      writeJson(STORAGE_KEYS.draftHtml, content.html);
      setSavedAt(timeLabel());
    }, 700);
    return () => clearTimeout(timer);
  }, [content.html, storeDocuments]);

  // Opening a saved document or analysis from the library hands its text to the editor.
  // The parameters are consumed immediately so a later reload cannot overwrite newer work.
  useEffect(() => {
    const docParam = searchParams.get("doc");
    const analysisParam = searchParams.get("analysis");
    if (!docParam && !analysisParam) return;
    const next = new URLSearchParams(searchParams);
    next.delete("doc");
    next.delete("analysis");
    setSearchParams(next, { replace: true });

    let active = true;
    void (async () => {
      let record = analysisParam ? await loadAnalysisRecord(analysisParam) : null;
      let target = record ? record.document : null;
      if (!record && !target && docParam) target = await loadDocument(docParam);
      if (!active) return;
      if (!target) {
        setNotice(
          "That saved item could not be opened: the text it was made from is no longer stored.",
        );
        return;
      }
      surface.current?.loadText(target.text);
      setOpenDoc({ id: target.id, title: target.title });
      lastDocText.current = target.text;
      setSavedDocAt(null);
      setDocSaveError(null);
      setSource(`saved document: ${target.title}`);
      const stored = record?.entry.result ?? null;
      setRun(stored ? { status: "done", result: stored, analysedText: target.text } : { status: "idle" });
      setNotice(
        stored
          ? `Opened “${target.title}” with the analysis saved from it. Run it again to measure the text as it stands now.`
          : `Opened “${target.title}”. Edits autosave into that document. Press Ctrl+Z to get your previous text back.`,
      );
    })();
    return () => {
      active = false;
    };
  }, [searchParams, setSearchParams]);

  // Autosave for an opened document. An emptied editor never overwrites a stored one —
  // clearing the surface is not the same decision as deleting a document.
  useEffect(() => {
    if (!openDoc || content.text === lastDocText.current) return;
    if (content.text.trim().length === 0) return;
    const timer = setTimeout(() => {
      lastDocText.current = content.text;
      void (async () => {
        try {
          const updated = await putDocumentText(openDoc.id, content.text);
          if (!updated) {
            setDocSaveError("that document is no longer stored");
            return;
          }
          setOpenDoc({ id: updated.id, title: updated.title });
          setSavedDocAt(timeLabel());
          setDocSaveError(null);
        } catch (error) {
          setDocSaveError(error instanceof Error ? error.message : "the write did not go through");
        }
      })();
    }, 700);
    return () => clearTimeout(timer);
  }, [openDoc, content.text]);

  const documentStatus = !openDoc ? null : content.text.trim().length === 0 ? (
    <span>Autosave paused while the editor is empty</span>
  ) : docSaveError ? (
    <span className="text-warning">Not saved — {docSaveError}</span>
  ) : savedDocAt ? (
    <span>
      Saved to “{openDoc.title}” {savedDocAt}
    </span>
  ) : (
    <span>Editing “{openDoc.title}”</span>
  );

  function saveThisAnalysis() {
    if (run.status !== "done") return;
    void (async () => {
      setSaving(true);
      try {
        const record = await putAnalysis({
          result: run.result,
          text: run.analysedText,
          documentId: openDoc?.id ?? null,
          title: openDoc?.title,
        });
        setSavedEntryId(record.entry.id);
        setOpenDoc({ id: record.document.id, title: record.document.title });
        lastDocText.current = record.document.text;
        setDocSaveError(null);
        toast({
          title: record.persisted ? "Analysis saved" : "Analysis kept for this session only",
          description: record.persisted
            ? `“${record.document.title}” and its measurement are in your library. Find them under History.`
            : "Local saving is off in Preferences, so this record disappears when the tab closes.",
          variant: record.persisted ? "success" : "warning",
        });
      } catch (error) {
        toast({
          title: "The analysis was not saved",
          description:
            error instanceof Error ? error.message : "The library would not take the record.",
          variant: "error",
        });
      } finally {
        setSaving(false);
      }
    })();
  }

  const analyze = useCallback(async () => {
    const quota = guard.check(countWords(text));
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
      const result = await detectText(text, {
        language: language === AUTO ? undefined : language,
        signal: controller.signal,
        onPhase: (phase) => {
          if (abortRef.current === controller) setRun({ status: "running", phase });
        },
      });
      if (abortRef.current !== controller) return;
      abortRef.current = null;
      // Only a finished run is charged; a cancel or a failure costs nothing.
      guard.record(result.metrics.words);
      setRun({ status: "done", result, analysedText: text });
      toast({
        title: "Analysis finished",
        description: `${formatNumber(result.metrics.words)} words measured. Read the result as an estimate, not a verdict.`,
        variant: "success",
      });
    } catch (error) {
      if (abortRef.current !== controller) return;
      abortRef.current = null;
      const serviceError = toServiceError(error);
      setRun({ status: "error", error: serviceError });
      toast({ title: "Analysis stopped", description: serviceError.message, variant: "error" });
    }
  }, [text, language, toast, guard]);

  function cancel() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setRun({ status: "idle" });
    setNotice("Analysis cancelled. Your text is still here.");
  }

  useKeyboardShortcuts({ onAnalyze: () => void analyze(), enabled: !running && !tooShort && !tooLong });

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
    setNotice(null);
    toast({
      title: `${outcome.file.filename} loaded`,
      description: `${formatNumber(outcome.file.characters)} characters read from the file.`,
      variant: "success",
    });
  }

  function loadExample() {
    const sample = SAMPLE_DOCUMENTS[sampleIndex.current % SAMPLE_DOCUMENTS.length];
    sampleIndex.current += 1;
    surface.current?.loadText(sample.text);
    setSource(`example: ${sample.title}`);
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

  return (
    <>
      <PageHeader
        title="AI Detector"
        description="Analyze your text for patterns associated with AI-generated or AI-assisted writing."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "AI Detector" }]}
        actions={
          <>
            <label className="sr-only" htmlFor="detector-language">
              Analysis language
            </label>
            <Select
              id="detector-language"
              className="h-8 w-auto min-w-[10.5rem] text-2xs"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageChoice)}
            >
              {DETECTOR_LANGUAGE_CHOICES.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.label}
                </option>
              ))}
            </Select>
            <Button asChild variant="subtle" size="sm">
              <Link to="/history">
                <History className="size-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">History</span>
              </Link>
            </Button>
            <Button asChild variant="subtle" size="sm">
              <Link to="/settings">
                <Settings2 className="size-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Settings</span>
              </Link>
            </Button>
            <Button asChild variant="subtle" size="sm">
              <Link to="/help">
                <HelpCircle className="size-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Help</span>
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

          <div ref={editorCardRef}>
            <RichTextEditor
              ref={surface}
              initialHtml={draftHtml}
              onChange={handleContentChange}
              onPaste={() => void pasteFromClipboard()}
              onUpload={() => fileInputRef.current?.click()}
              onImport={() => setImportOpen(true)}
              onFiles={(files) => void loadFiles(files)}
              minWords={MIN_WORDS}
              maxWords={MAX_WORDS}
              disabled={false}
              ariaLabel="Text to analyse"
              savedAt={savedAt}
              analysis={analysis}
              selectedSentence={selectedSentence}
              sentenceFilter={sentenceFilter}
              showSentenceScores={showSentenceScores}
              onSentenceSelect={setSelectedSentence}
              onSentenceHover={setHovered}
              onHighlightStatus={setHighlightStatus}
              status={
                <>
                  {source ? (
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3" aria-hidden />
                      {source}
                    </span>
                  ) : null}
                  {documentStatus ?? (savedAt ? <span>Draft saved {savedAt}</span> : null)}
                </>
              }
            />
          </div>

          {result ? (
            <SentenceInspector
              sentences={result.sentences}
              documentSignals={result.signals}
              engineLabel={`${result.engine} v${result.engineVersion}`}
              filter={sentenceFilter}
              onFilterChange={setSentenceFilter}
              selected={selectedSentence}
              onSelect={setSelectedSentence}
              showScores={showSentenceScores}
              onShowScoresChange={(value) => updatePreferences({ showSentenceScores: value })}
              showConfidence={showConfidence}
              onShowConfidenceChange={(value) => updatePreferences({ showConfidence: value })}
              showExplanations={showExplanations}
              onShowExplanationsChange={(value) => updatePreferences({ showExplanations: value })}
              painted={highlightStatus?.painted ?? 0}
              unmapped={highlightStatus?.unmapped ?? 0}
              mappingReason={highlightStatus?.reason ?? null}
            />
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Reset first: choosing the same file again has to fire a change event.
              event.target.value = "";
              if (files.length > 0) void loadFiles(files);
            }}
          />

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {DETECTION_DISCLAIMER_SHORT}{" "}
              <Link to="/legal/detection-limitations" className="underline underline-offset-2">
                How the engine decides
              </Link>
            </p>
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <div className="space-y-2">
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => void analyze()}
                disabled={running || tooShort || tooLong}
              >
                {running ? <Spinner size="sm" /> : <Gauge className="size-4" aria-hidden />}
                {analyzeButtonLabel(running ? run.phase : null)}
              </Button>

              {running ? (
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={cancel}>
                  <Square className="size-3.5" aria-hidden />
                  Cancel analysis
                </Button>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={loadExample}>
                  <Sparkles className="size-3.5" aria-hidden />
                  Try Example
                </Button>
                <p className="text-2xs text-muted-foreground">
                  {SAMPLE_DOCUMENTS.length} built-in examples
                </p>
              </div>

              <p className="pt-1 text-2xs leading-relaxed text-muted-foreground">
                {tooShort ? (
                  <>
                    Needs at least {MIN_WORDS} words. This has {formatNumber(words)}. Paste text,
                    drop a file or load an example.
                  </>
                ) : tooLong ? (
                  <>
                    {formatNumber(words - MAX_WORDS)} words over the {formatNumber(MAX_WORDS)} word
                    limit. Analyse a section at a time.
                  </>
                ) : running ? (
                  <>Analysing {formatNumber(words)} words…</>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <CircleCheck className="size-3.5" aria-hidden />
                    Ready to analyze · {formatNumber(words)} words
                  </span>
                )}
              </p>
              <p className="text-2xs text-muted-foreground">
                Shortcut: Ctrl+Enter (Cmd+Enter) runs the analysis.
              </p>
            </div>
          </Card>

          {run.status === "running" ? <AnalysisProgress phase={run.phase} /> : null}

          {run.status === "error" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <ErrorState
                  compact
                  error={run.error}
                  onRetry={run.error.code === "auth" ? undefined : () => void analyze()}
                  retryLabel="Run again"
                />
              </CardContent>
            </Card>
          ) : null}

          {run.status === "done" ? (
            <>
              <DetectionResultDashboard
                result={run.result}
                sourceLabel={source}
                actions={reportSource ? <ReportActionBar source={reportSource} /> : null}
              />

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={savedEntryId ? "subtle" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={saveThisAnalysis}
                    disabled={savedEntryId !== null || saving}
                    loading={saving}
                  >
                    {savedEntryId ? (
                      <CircleCheck className="size-3.5" aria-hidden />
                    ) : (
                      <Save className="size-3.5" aria-hidden />
                    )}
                    {savedEntryId ? "Analysis saved" : saving ? "Saving…" : "Save analysis"}
                  </Button>
                  {savedEntryId ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/history">Open history</Link>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
                  {savedEntryId
                    ? openDoc
                      ? `Kept with “${openDoc.title}”, which now holds the text this result measured.`
                      : "Kept as a new document holding the text this result measured, so the row can be reopened later."
                    : librarySource.backendConfigured
                      ? "Stores the measurement with the exact text it was made from, on the attached library service."
                      : "Stores the measurement with the exact text it was made from. Nothing is sent anywhere; this stays on the device."}
                </p>
                {!storeDocuments && !librarySource.backendConfigured && savedEntryId === null ? (
                  <p className="mt-1 text-2xs leading-relaxed text-warning">
                    Local saving is off in Preferences, so a save now lasts only this session.
                  </p>
                ) : null}
              </Card>

              {text !== run.analysedText ? (
                <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-surface-sunken px-4 py-2.5 text-2xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                  The text has changed since this run ({formatNumber(words)} words now,{" "}
                  {formatNumber(run.result.metrics.words)} measured). Run it again for a result that
                  matches what is in the editor.
                </p>
              ) : null}
            </>
          ) : null}

          {run.status === "idle" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <EmptyState
                  compact
                  icon={Gauge}
                  title="No result yet"
                  description={
                    capabilities.runningLocally
                      ? "Detection runs in this browser with the built-in engine, so your text is not sent anywhere."
                      : "Detection runs on the analysis service attached to this deployment."
                  }
                  action={
                    <Badge variant="outline" size="sm">
                      {capabilities.runningLocally
                        ? `Engine ${capabilities.engineId} v${capabilities.engineVersion}`
                        : "The service names its model on each result"}
                    </Badge>
                  }
                />
                <details className="group mt-1 border-t border-border px-4 py-2">
                  <summary className="cursor-pointer list-none text-2xs text-muted-foreground transition-colors hover:text-foreground">
                    Why a score is not proof
                  </summary>
                  <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
                    {DETECTION_DISCLAIMER}
                  </p>
                </details>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {result && analytics ? (
        <div className="grid gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <AnalyticsPanel
            analytics={analytics}
            selected={selectedSentence}
            onSelectSentence={setSelectedSentence}
          />
        </div>
      ) : null}

      {hovered && hoveredSentence ? (
        <SentenceHoverCard
          sentence={hoveredSentence}
          rect={hovered.rect}
          showConfidence={showConfidence}
        />
      ) : null}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onPick={importDocument} />

      <AssistantDock
        documentText={text}
        language={language === AUTO ? undefined : language}
        getSelection={() => surface.current?.getSelectionText() ?? ""}
        onInsert={(value) => surface.current?.insertText(value)}
      />
    </>
  );
}

/** Clock time used in the "Saved" read-out; the store keeps the full timestamp. */
function timeLabel() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

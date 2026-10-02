import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  Copy,
  Download,
  Gauge,
  Info,
  Languages,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImportDialog } from "@/components/detector/ImportDialog";
import { TextPane } from "@/components/tools/TextPane";
import { quotaError, useQuota } from "@/hooks/useQuota";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/loader";
import { useToast } from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toServiceError } from "@/lib/api";
import { downloadTextFile, safeFileName } from "@/lib/download";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { countWords } from "@/lib/text";
import { MAX_WORDS, cn, formatNumber } from "@/lib/utils";
import { SAMPLE_TRANSLATOR_INPUT } from "@/data/sampleDocuments";
import { usePreferencesStore } from "@/store/preferencesStore";
import {
  TRANSLATION_LANGUAGES,
  TRANSLATOR_NOTE,
  describeTranslationRun,
  detectSourceLanguage,
  getTranslatorStatus,
  languageGroups,
  languageLabel,
  textDirection,
  translateText,
  translationSegments,
} from "@/services/translatorService";
import type { SupportedCode, TranslationResult } from "@/services/translatorService";
import type { AnalysisPhase, ServiceError, StoredDocument } from "@/types";

type SourceChoice = SupportedCode | "auto";

type RunState =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase }
  | { status: "done"; result: TranslationResult; input: string }
  | { status: "error"; error: ServiceError };

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Preparing the text",
  normalizing: "Cleaning the spacing",
  analyzing: "Asking the translation service",
  scoring: "Aligning the sentences",
  reporting: "Reading the result back",
};

/** The picker needs a stable order; the registry groups by the language's own script. */
const GROUPS = languageGroups(TRANSLATION_LANGUAGES);
const TARGET_DEFAULT: SupportedCode = "en";

const NO_SERVICE_TEXT =
  "This build has no translation service attached, so the box stays empty rather than filling with a rearranged version of your text.";

function LanguagePicker({
  id,
  label,
  value,
  onChange,
  allowAuto,
  detected,
}: {
  id: string;
  label: string;
  value: SourceChoice;
  onChange(value: SourceChoice): void;
  allowAuto?: boolean;
  detected?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {allowAuto && value === "auto" && detected ? (
          <span className="truncate text-2xs text-muted-foreground">{detected}</span>
        ) : null}
      </div>
      <Select
        id={id}
        className="mt-1"
        value={value}
        onChange={(event) => onChange(event.target.value as SourceChoice)}
      >
        {allowAuto ? <option value="auto">Detect automatically</option> : null}
        {GROUPS.map((group) => (
          <optgroup key={group.name} label={group.name}>
            {group.languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label} · {language.nativeLabel}
                {language.rtl ? " (right to left)" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}

export function TranslatorPage() {
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const { toast } = useToast();
  const guard = useQuota("translator");
  const status = useMemo(() => getTranslatorStatus(), []);

  const [input, setInput] = useState(() =>
    storeDocuments ? readJson<string>(STORAGE_KEYS.translatorInput, "") : "",
  );
  const [source, setSource] = useState<SourceChoice>("auto");
  const [target, setTarget] = useState<SourceChoice>(TARGET_DEFAULT);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [showSegments, setShowSegments] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const lastSaved = useRef(input);

  useEffect(() => () => abortRef.current?.abort(), []);

  const words = countWords(input);
  const tooLong = words > MAX_WORDS;
  const running = run.status === "running";
  const result = run.status === "done" ? run.result : null;

  // Detection is local, so it answers while the user types, with or without a backend.
  const detected = useMemo(
    () => (input.trim().length > 0 ? detectSourceLanguage(input) : null),
    [input],
  );
  const sourceCode: SupportedCode = source === "auto" ? detected?.code ?? "en" : source;
  const targetCode: SupportedCode = target === "auto" ? TARGET_DEFAULT : target;
  const stale = run.status === "done" && run.input !== input;
  const segments = useMemo(
    () => (input.trim().length > 0 ? translationSegments(input) : []),
    [input],
  );

  useEffect(() => {
    if (!storeDocuments || input === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = input;
      writeJson(STORAGE_KEYS.translatorInput, input);
    }, 700);
    return () => clearTimeout(timer);
  }, [input, storeDocuments]);

  const translate = useCallback(
    async (from: SourceChoice, to: SupportedCode) => {
      const quota = guard.check(words);
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
      const text = input;
      setRun({ status: "running", phase: "preparing" });

      try {
        const next = await translateText(text, {
          source: from,
          target: to,
          signal: controller.signal,
          onPhase: (phase) => {
            if (abortRef.current === controller) setRun({ status: "running", phase });
          },
        });
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        if ("translated" in next) {
          setRun({ status: "done", result: next, input: text });
          guard.record(words);

          setNotice(null);
          toast({ title: "Translation ready", description: describeTranslationRun(next) });
        } else {
          setRun({ status: "error", error: next });
          toast({ title: "Nothing was translated", description: next.message, variant: "warning" });
        }
      } catch (error) {
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        const serviceError = toServiceError(error);
        setRun({ status: "error", error: serviceError });
        toast({ title: "Translation stopped", description: serviceError.message, variant: "error" });
      }
    },
    [input, guard, toast],
  );

  function start() {
    void translate(source, targetCode);
  }

  useKeyboardShortcuts({ onAnalyze: start, enabled: !running && words > 0 && !tooLong });

  function cancel() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setRun({ status: "idle" });
    setNotice("Translation cancelled. Your text is still here.");
  }

  function swap() {
    const from = sourceCode;
    const to = targetCode;
    setSource(to);
    setTarget(from);
    if (result) {
      setInput(result.translated);
      setRun({ status: "idle" });
      setNotice(
        `The two directions are swapped, and the text that came back is now the input: ${languageLabel(to)} into ${languageLabel(from)}.`,
      );
    } else {
      setNotice(`The two directions are now ${languageLabel(to)} into ${languageLabel(from)}.`);
    }
  }

  async function copyOutput() {
    if (!result) return;
    if (!navigator.clipboard?.writeText) {
      setNotice(
        "This browser does not let the page write to your clipboard. Select the translation and copy it yourself.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(result.translated);
      toast({ title: "Translation copied", description: "It is on your clipboard." });
    } catch {
      setNotice(
        "The browser blocked the copy. Select the translated text and press Ctrl+C (Cmd+C on a Mac).",
      );
    }
  }

  function downloadOutput() {
    if (!result) return;
    const name = `${safeFileName(languageLabel(targetCode), "translation")}-translated.txt`;
    if (downloadTextFile(name, result.translated, "text/plain")) {
      setNotice(`Saved as ${name}.`);
    } else {
      setNotice("This browser would not start the download. Copy the text instead.");
    }
  }

  function loadSample() {
    setNotice(null);
    setInput(SAMPLE_TRANSLATOR_INPUT);
    setSource("auto");
    setRun({ status: "idle" });
  }

  function importDocument(picked: StoredDocument) {
    setInput(picked.text);
    setSource("auto");
    setRun({ status: "idle" });
    setNotice(`Loaded “${picked.title}” from your saved documents.`);
  }

  const alignment = result
    ? result.segments.filter((segment) => segment.target.trim().length > 0).length
    : 0;

  return (
    <>
      <PageHeader
        title="Translator"
        description="Two columns, one language in and one out, with the sentence alignment kept visible."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Translator" }]}
        actions={
          <>
            <Badge variant={status.available ? "outline" : "warning"} size="sm">
              {status.available ? "Translation service connected" : "No translation service"}
            </Badge>
            <Button asChild variant="subtle" size="sm">
              <Link to="/detector">
                <Gauge className="size-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Check with the Detector</span>
              </Link>
            </Button>
          </>
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

          <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <LanguagePicker
              id="translator-source"
              label="Source language"
              value={source}
              onChange={setSource}
              allowAuto
              detected={
                detected
                  ? `read as ${detected.label}, ${Math.round(detected.confidence * 100)}% sure`
                  : "nothing typed yet"
              }
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={swap}
              className="sm:mb-0.5"
              disabled={running}
            >
              <ArrowLeftRight className="size-3.5" aria-hidden />
              Swap
            </Button>
            <LanguagePicker
              id="translator-target"
              label="Target language"
              value={target}
              onChange={(value) => setTarget(value === "auto" ? TARGET_DEFAULT : value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TextPane
              label="Source text"
              role={languageLabel(sourceCode)}
              value={input}
              onChange={(value) => {
                setInput(value);
                setNotice(null);
              }}
              placeholder="Paste the text you want translated. Detection runs here in your browser, so the source box never needs a language picked by hand."
              dir={textDirection(sourceCode)}
              toolbar={
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
                    Import
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={loadSample}>
                    <Sparkles className="size-3.5" aria-hidden />
                    Sample
                  </Button>
                </>
              }
            />

            <TextPane
              label="Translation"
              role={languageLabel(targetCode)}
              value={result?.translated ?? ""}
              placeholder="The translated text appears here once a translation service answers."
              dir={textDirection(targetCode)}
              empty={
                <EmptyState
                  compact
                  icon={Languages}
                  title="Nothing translated yet"
                  description={
                    status.available
                      ? `Pick a target language and run it. ${formatNumber(status.languageCount)} languages are wired into the picker.`
                      : NO_SERVICE_TEXT
                  }
                />
              }
              toolbar={
                result ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSegments((value) => !value)}
                  >
                    {showSegments ? "Whole text" : "Sentence by sentence"}
                  </Button>
                ) : undefined
              }
              body={
                result ? (
                  showSegments ? (
                    <div className="min-h-[18rem] flex-1 space-y-2.5 overflow-auto px-5 py-4">
                      {result.segments.map((segment, index) => (
                        <div
                          key={`${index}-${segment.source.slice(0, 12)}`}
                          className="rounded-lg border border-border bg-surface-sunken px-3 py-2.5"
                        >
                          <p className="text-2xs leading-relaxed text-muted-foreground line-through decoration-border">
                            {segment.source}
                          </p>
                          <p
                            dir={textDirection(result.targetLanguage)}
                            className="mt-1 flex gap-1.5 text-[0.9375rem] leading-[1.7] text-foreground"
                          >
                            <ArrowRight className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden />
                            <span>{segment.target || "The service returned no line for this sentence."}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      dir={textDirection(result.targetLanguage)}
                      className="min-h-[18rem] flex-1 overflow-auto whitespace-pre-wrap px-5 py-4 text-[0.9375rem] leading-[1.7] text-foreground"
                    >
                      {result.translated}
                    </p>
                  )
                ) : undefined
              }
            />
          </div>

          {result ? (
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">What came back</CardTitle>
                <Badge variant={alignment === result.segments.length ? "success" : "warning"} size="xs">
                  {alignment} of {result.segments.length} sentences translated
                </Badge>
                <p className="ml-auto text-2xs text-muted-foreground tabular">
                  {formatNumber(words)} source words · {formatNumber(countWords(result.translated))} words back
                </p>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                {describeTranslationRun(result)}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                A translation is another author&apos;s reading of your text. Check names, numbers and
                tone against the original before you submit it anywhere.
              </p>

              {stale ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/35 bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                  The input has changed since this translation ({formatNumber(words)} words now,{" "}
                  {formatNumber(countWords(run.input))} when it ran). Run it again on the text you have.
                </p>
              ) : null}
            </Card>
          ) : null}

          {input.trim().length > 0 && segments.length > 0 ? (
            <Card className="p-4">
              <CardTitle className="text-sm">Sentences this run would send</CardTitle>
              <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                {formatNumber(segments.length)} sentences, split by your browser rather than the
                service. Sending them one at a time is what lets the result be read back against the
                original, line for line.
              </p>
              <ol className="mt-2 space-y-1">
                {segments.slice(0, 4).map((segment, index) => (
                  <li key={index} className="flex gap-2 text-2xs leading-relaxed text-muted-foreground">
                    <span className="tabular">{index + 1}.</span>
                    <span className={cn("min-w-0 truncate", index === 3 && segments.length > 4 && "italic")}>
                      {index === 3 && segments.length > 4
                        ? `${formatNumber(segments.length - 3)} more sentences`
                        : segment.source}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-2xs leading-relaxed text-muted-foreground">{TRANSLATOR_NOTE}</p>
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
                disabled={running || words === 0 || tooLong}
              >
                {running ? <Spinner size="sm" /> : <Languages className="size-4" aria-hidden />}
                {running ? `${PHASE_LABEL[run.phase]}…` : "Translate"}
              </Button>

              {running ? (
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={cancel}>
                  <Square className="size-3.5" aria-hidden />
                  Cancel translation
                </Button>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyOutput()}
                  disabled={!result}
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={downloadOutput}
                  disabled={!result}
                >
                  <Download className="size-3.5" aria-hidden />
                  .txt
                </Button>
              </div>

              <p className="text-2xs leading-relaxed text-muted-foreground">
                {words === 0 ? (
                  "Type or paste something first."
                ) : tooLong ? (
                  <>
                    {formatNumber(words - MAX_WORDS)} words over the {formatNumber(MAX_WORDS)} word
                    limit. Work through a document a section at a time.
                  </>
                ) : running ? (
                  PHASE_LABEL[run.phase]
                ) : stale ? (
                  "Your text changed after the last run. Translate it again."
                ) : (
                  <>
                    {languageLabel(sourceCode)} → {languageLabel(targetCode)}.{" "}
                    {formatNumber(status.languageCount)} languages available in each picker.
                  </>
                )}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <CardTitle className="text-sm">Translation service</CardTitle>
            <dl className="mt-2 space-y-1.5 text-2xs leading-relaxed text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="min-w-0">Status</dt>
                <dd className="ml-auto">
                  <Badge variant={status.available ? "success" : "warning"} size="xs">
                    {status.available ? "Connected" : "Not connected"}
                  </Badge>
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="min-w-0">Languages wired in</dt>
                <dd className="ml-auto tabular text-foreground">{formatNumber(status.languageCount)}</dd>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="min-w-0">Language detection</dt>
                <dd className="ml-auto text-foreground">Runs in this browser</dd>
              </div>
            </dl>
            {status.note ? (
              <p className="mt-2 rounded-lg border border-warning/35 bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
                {status.note}
              </p>
            ) : null}
          </Card>

          {run.status === "error" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <ErrorState compact error={run.error} onRetry={start} retryLabel="Translate again" />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onPick={importDocument} />
    </>
  );
}

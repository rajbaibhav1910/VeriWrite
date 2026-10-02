import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Diff,
  Eye,
  EyeOff,
  Gauge,
  Info,
  Languages,
  RefreshCw,
  Replace,
  ShieldCheck,
  Sparkles,
  Square,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImportDialog } from "@/components/detector/ImportDialog";
import { TextPane } from "@/components/tools/TextPane";
import { WordChangeText } from "@/components/tools/WordChangeText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/loader";
import { useToast } from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toServiceError } from "@/lib/api";
import { quotaError, useQuota } from "@/hooks/useQuota";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { mapWordChanges, describeWordChanges } from "@/lib/tools/wordDiff";
import { countWords } from "@/lib/text";
import { LANGUAGE_NAMES } from "@/config/languages";
import { SAMPLE_DOCUMENTS } from "@/data/sampleDocuments";
import { formatNumber, MAX_WORDS } from "@/lib/utils";
import { usePreferencesStore } from "@/store/preferencesStore";
import {
  PARAPHRASE_MIN_WORDS,
  PARAPHRASE_MODES,
  PARAPHRASE_TONES,
  getParaphraseCapabilities,
  paraphraseText,
} from "@/services/paraphraseService";
import type {
  AnalysisPhase,
  LanguageCode,
  ParaphraseMode,
  ParaphraseResult,
  ServiceError,
  StoredDocument,
} from "@/types";

type RunState =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase }
  | { status: "done"; result: ParaphraseResult; sourceText: string }
  | { status: "error"; error: ServiceError };

/** What the rewriter is doing, in the words the local engine's own stages mean. */
const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Checking the passage",
  normalizing: "Cleaning the spacing",
  analyzing: "Reading your sentences",
  scoring: "Rewriting the wording",
  reporting: "Comparing the two texts",
};

/** The synonym slider is a percentage; these tiers name what the level does. */
function synonymTier(level: number) {
  if (level <= 30) return "Light touch — most of your wording stays";
  if (level <= 70) return "Balanced — the rewriter changes what it can safely";
  return "Adventurous — expect more of the sentence to come back different";
}

export function ParaphrasePage() {
  const capabilities = getParaphraseCapabilities();
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const { toast } = useToast();
  const guard = useQuota("paraphraser");

  const [input, setInput] = useState(() =>
    storeDocuments ? readJson<string>(STORAGE_KEYS.paraphraseInput, "") : "",
  );
  const [mode, setMode] = useState<ParaphraseMode>("standard");
  const [tone, setTone] = useState<string>("neutral");
  const [language, setLanguage] = useState<LanguageCode>(
    capabilities.languages.includes("en") ? "en" : capabilities.languages[0] ?? "en",
  );
  const [synonymLevel, setSynonymLevel] = useState(60);
  const [showMarks, setShowMarks] = useState(true);
  // How many times this text has been re-run: 0 is the first pass, and each later
  // number asks the rewriter for a different version of the same words.
  const [variant, setVariant] = useState(0);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // The wording "Replace" moved out of the input box, so the notice can offer it back.
  const [undoText, setUndoText] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastSaved = useRef(input);
  const sampleIndex = useRef(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const words = countWords(input);
  const tooShort = words < PARAPHRASE_MIN_WORDS;
  const tooLong = words > MAX_WORDS;
  const running = run.status === "running";
  const result = run.status === "done" ? run.result : null;
  const sourceText = run.status === "done" ? run.sourceText : "";
  const changed = run.status === "done" && input !== run.sourceText;

  const changes = useMemo(
    () => (result ? mapWordChanges(sourceText, result.output) : null),
    [result, sourceText],
  );

  // The input is the user's text, so it is kept on the device between visits — and
  // only while local saving is switched on in Preferences.
  useEffect(() => {
    if (!storeDocuments || input === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = input;
      writeJson(STORAGE_KEYS.paraphraseInput, input);
    }, 700);
    return () => clearTimeout(timer);
  }, [input, storeDocuments]);

  const activeMode = PARAPHRASE_MODES.find((entry) => entry.id === mode);

  const rewrite = useCallback(
    async (variant: number) => {
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
      setRun({ status: "running", phase: "preparing" });

      try {
        const next = await paraphraseText(input, {
          mode,
          tone,
          synonymLevel: synonymLevel / 100,
          language,
          variant,
          signal: controller.signal,
          onPhase: (phase) => {
            if (abortRef.current === controller) setRun({ status: "running", phase });
          },
        });
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        setRun({ status: "done", result: next, sourceText: input });
        guard.record(words);

        setNotice(null);
        toast({
          title: variant === 0 ? "Rewrite ready" : `Version ${variant + 1} ready`,
          description: `${formatNumber(next.changedWords)} of your words came back different. Read it before you use it.`,
          variant: "success",
        });
      } catch (error) {
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        const serviceError = toServiceError(error);
        setRun({ status: "error", error: serviceError });
        toast({ title: "Rewrite stopped", description: serviceError.message, variant: "error" });
      }
    },
    [input, mode, tone, synonymLevel, language, guard, toast],
  );

  useKeyboardShortcuts({
    onAnalyze: start,
    enabled: !running && !tooShort && !tooLong,
  });

  /** The first pass over the current text. */
  function start() {
    setVariant(0);
    void rewrite(0);
  }

  /** A different version of the same text: same settings, next seed. */
  function again() {
    const next = variant + 1;
    setVariant(next);
    void rewrite(next);
  }

  function handleInput(value: string) {
    setInput(value);
    setVariant(0);
    if (undoText !== null) setUndoText(null);
  }

  function cancel() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setRun({ status: "idle" });
    setNotice("Rewrite cancelled. Your text is still here.");
  }

  async function copyRewrite() {
    if (!result) return;
    if (!navigator.clipboard?.writeText) {
      setNotice(
        "This browser does not let the page write to your clipboard. Select the rewrite and copy it yourself.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(result.output);
      toast({ title: "Rewrite copied", description: "It is on your clipboard." });
    } catch {
      setNotice(
        "The browser blocked the copy. Select the rewrite text and press Ctrl+C (Cmd+C on a Mac).",
      );
    }
  }

  function replaceInput() {
    if (!result) return;
    setUndoText(input);
    setInput(result.output);
    setNotice("The rewrite is now in the input box, so you can run it through again.");
  }

  function restoreInput() {
    if (undoText === null) return;
    setInput(undoText);
    setUndoText(null);
    setNotice(null);
  }

  function loadExample() {
    const sample = SAMPLE_DOCUMENTS[sampleIndex.current % SAMPLE_DOCUMENTS.length];
    sampleIndex.current += 1;
    setUndoText(input.trim().length > 0 ? input : null);
    setInput(sample.text);
    setVariant(0);
    setRun({ status: "idle" });
    setNotice(`Loaded the “${sample.title}” example.`);
  }

  function importDocument(picked: StoredDocument) {
    setUndoText(input.trim().length > 0 ? input : null);
    setInput(picked.text);
    setVariant(0);
    setRun({ status: "idle" });
    setNotice(`Loaded “${picked.title}” from your saved documents.`);
  }

  return (
    <>
      <PageHeader
        title="Paraphraser"
        description="Rewrite a passage in another register, then read exactly which words came back different."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Paraphraser" }]}
        actions={
          <>
            <Badge variant="outline" size="sm">
              {capabilities.engine === "local" ? "Rewrites on this device" : "Paraphrase service"}
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
              {undoText !== null ? (
                <Button type="button" variant="link" size="sm" onClick={restoreInput}>
                  <Undo2 className="size-3.5" aria-hidden />
                  Put your earlier wording back
                </Button>
              ) : null}
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

          <div className="grid gap-3 md:grid-cols-2">
            <TextPane
              label="Input"
              role="your text"
              value={input}
              onChange={handleInput}
              placeholder="Paste or type the passage you want rewritten — at least three words. It stays on this device; you can also import a saved document or load an example."
              toolbar={
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
                    Import
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={loadExample}>
                    <Sparkles className="size-3.5" aria-hidden />
                    Example
                  </Button>
                </>
              }
            />

            <TextPane
              label="Rewrite"
              role={result ? `${result.mode} output` : "output"}
              value={result?.output ?? ""}
              placeholder="Your rewrite appears here."
              toolbar={
                result ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMarks((current) => !current)}
                  >
                    {showMarks ? (
                      <EyeOff className="size-3.5" aria-hidden />
                    ) : (
                      <Eye className="size-3.5" aria-hidden />
                    )}
                    {showMarks ? "Hide changes" : "Show changes"}
                  </Button>
                ) : null
              }
              empty={
                <EmptyState
                  compact
                  icon={Diff}
                  title="No rewrite yet"
                  description={
                    capabilities.engine === "local"
                      ? "Rewriting happens in this browser with the built-in rewriter, so your text is not sent anywhere."
                      : "Rewriting runs on the paraphrase service attached to this deployment."
                  }
                />
              }
              body={
                result && changes ? (
                  <div className="min-h-[18rem] flex-1 overflow-auto px-5 py-4">
                    {showMarks ? (
                      <WordChangeText map={changes} output={result.output} />
                    ) : (
                      <p className="whitespace-pre-wrap text-[0.9375rem] leading-[1.7] text-foreground">
                        {result.output}
                      </p>
                    )}
                  </div>
                ) : undefined
              }
            />
          </div>

          {changes && result ? (
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">Word changes</CardTitle>
                <Badge variant={changes.aligned ? "info" : "warning"} size="xs">
                  {changes.aligned ? "Matched sentence for sentence" : "Compared by word kind"}
                </Badge>
                <p className="ml-auto text-2xs text-muted-foreground">
                  {formatNumber(countWords(sourceText))} words in · {formatNumber(changes.rewriteWords)} out
                </p>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                {describeWordChanges(changes)}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Figure label="Words that no longer appear" value={formatNumber(changes.dropped)} />
                <Figure label="Words the rewrite brought in" value={formatNumber(changes.introduced)} />
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Still your wording
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular">
                    {Math.round(result.similarity * 100)}%
                  </p>
                  <Progress
                    aria-label="Share of the original wording the rewrite kept"
                    value={Math.round(result.similarity * 100)}
                    className="mt-1"
                  />
                </div>
              </div>

              {changed ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/35 bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                  The input has changed since this rewrite ({formatNumber(words)} words now,{" "}
                  {formatNumber(countWords(sourceText))} when it ran). The marks above describe the
                  text it was given, not what is in the box now.
                </p>
              ) : null}
            </Card>
          ) : null}

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-2xs leading-relaxed text-muted-foreground">
              A rewrite changes wording, not meaning you agreed to: read it against your own text
              before submitting anything. It is also not a way around an AI detector — detection
              looks at patterns across a whole document, and one pass of synonyms can leave them
              almost untouched.{" "}
              <Link to="/legal/detection-limitations" className="underline underline-offset-2">
                How detection works
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
                onClick={start}
                disabled={running || tooShort || tooLong}
              >
                {running ? <Spinner size="sm" /> : <Wand2 className="size-4" aria-hidden />}
                {running ? PHASE_LABEL[run.phase] + "…" : "Paraphrase"}
              </Button>

              {running ? (
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={cancel}>
                  <Square className="size-3.5" aria-hidden />
                  Cancel rewrite
                </Button>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={again}
                  disabled={running || tooShort || tooLong || !result}
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  Rewrite
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyRewrite()}
                  disabled={!result}
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="col-span-2"
                  onClick={replaceInput}
                  disabled={!result}
                >
                  <Replace className="size-3.5" aria-hidden />
                  Replace
                </Button>
              </div>

              <p className="text-2xs leading-relaxed text-muted-foreground">
                {tooShort ? (
                  <>
                    Needs at least {PARAPHRASE_MIN_WORDS} words. This has {formatNumber(words)}.
                  </>
                ) : tooLong ? (
                  <>
                    {formatNumber(words - MAX_WORDS)} words over the {formatNumber(MAX_WORDS)} word
                    limit. Rewrite a section at a time.
                  </>
                ) : running ? (
                  PHASE_LABEL[run.phase] + "."
                ) : result ? (
                  "Rewrite asks for another version of the same text. Replace moves it into the input box, and the notice offers to put your earlier wording back."
                ) : (
                  <>
                    Ready · {formatNumber(words)} words. Ctrl+Enter (Cmd+Enter) runs it.
                  </>
                )}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-sm">Rewriting choices</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="paraphrase-mode">Mode</Label>
                <Select
                  id="paraphrase-mode"
                  className="mt-1"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as ParaphraseMode)}
                >
                  {PARAPHRASE_MODES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                  {activeMode?.note}
                </p>
              </div>

              <div>
                <Label htmlFor="paraphrase-tone">Tone</Label>
                <Select
                  id="paraphrase-tone"
                  className="mt-1"
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                  disabled={!capabilities.toneControl}
                >
                  {PARAPHRASE_TONES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry[0]!.toUpperCase() + entry.slice(1)}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                  {capabilities.toneControl
                    ? "Passed to the paraphrase service with the request."
                    : "The rewriter built into this device does not vary its wording by tone label. Choosing a tone here changes nothing until a paraphrase service is attached."}
                </p>
              </div>

              <div>
                <Label htmlFor="paraphrase-language">Language</Label>
                <Select
                  id="paraphrase-language"
                  className="mt-1"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as LanguageCode)}
                  disabled={capabilities.languages.length < 2}
                >
                  {capabilities.languages.map((code) => (
                    <option key={code} value={code}>
                      {LANGUAGE_NAMES[code] ?? code}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
                  <Languages className="mt-px size-3.5 shrink-0" aria-hidden />
                  {capabilities.languages.length < 2
                    ? "Only English. The bundled lexicon has no synonym set for the other languages the detector reads; those need a paraphrase service."
                    : "The attached service is asked to rewrite in this language."}
                </p>
              </div>

              <div>
                <Label htmlFor="paraphrase-synonyms">
                  Synonym level
                  <span className="ml-auto font-normal tabular text-muted-foreground">
                    {synonymLevel}%
                  </span>
                </Label>
                <Slider
                  id="paraphrase-synonyms"
                  className="mt-1"
                  min={10}
                  max={100}
                  step={5}
                  value={[synonymLevel]}
                  aria-label="Synonym level"
                  onValueChange={([value]) => setSynonymLevel(value ?? 60)}
                />
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  {synonymTier(synonymLevel)}
                </p>
              </div>
            </div>
          </Card>

          {run.status === "error" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <ErrorState
                  compact
                  error={run.error}
                  onRetry={run.error.code === "auth" ? undefined : start}
                  retryLabel="Rewrite again"
                />
              </CardContent>
            </Card>
          ) : null}

          {run.status === "idle" && !result ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2">
                <EmptyState
                  compact
                  icon={Wand2}
                  title="How the rewrite is chosen"
                  description="The rewriter works sentence by sentence: it swaps words it has an equivalent for and leaves the rest of your text exactly as it is."
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={start} disabled={tooShort || tooLong}>
                      Run it on this text
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

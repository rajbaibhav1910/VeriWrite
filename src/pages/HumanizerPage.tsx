import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Copy,
  Gauge,
  Info,
  RefreshCw,
  Replace,
  ShieldCheck,
  Sparkles,
  Square,
  Type,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImportDialog } from "@/components/detector/ImportDialog";
import { TextPane } from "@/components/tools/TextPane";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/loader";
import { useToast } from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toServiceError } from "@/lib/api";
import { quotaError, useQuota } from "@/hooks/useQuota";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import { countWords, splitSentences } from "@/lib/text";
import { MAX_WORDS, cn, formatNumber } from "@/lib/utils";
import { SAMPLE_HUMANIZER_INPUT } from "@/data/sampleDocuments";
import { usePreferencesStore } from "@/store/preferencesStore";
import {
  DEFAULT_HUMANIZER_OPTIONS,
  HUMANIZER_MIN_WORDS,
  HUMANIZER_NOTE,
  HUMANIZER_TONES,
  allowsContractions,
  describeHumanizerRun,
  humanizeText,
  toneBucket,
} from "@/services/humanizerService";
import type { HumanizerChange, HumanizerResult } from "@/services/humanizerService";
import type { AnalysisPhase, ServiceError, StoredDocument } from "@/types";

type RunState =
  | { status: "idle" }
  | { status: "running"; phase: AnalysisPhase }
  | { status: "done"; result: HumanizerResult; input: string }
  | { status: "error"; error: ServiceError };

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Checking the passage",
  normalizing: "Cleaning the spacing",
  analyzing: "Reading the rhythm",
  scoring: "Rewriting for style",
  reporting: "Measuring the change",
};

/** What each edit kind did, in the words the change list shows. */
const CHANGE_KIND: Record<HumanizerChange["kind"], string> = {
  split: "Split a sentence",
  join: "Joined sentences",
  contraction: "Used a contraction",
  transition: "Changed a connective",
  concision: "Cut wordiness",
  subordinate: "Linked two beats",
  opening: "Varied an opening",
};

const TONE_EFFECT: Record<ReturnType<typeof toneBucket>, string> = {
  formal: "Keeps the elevated connectives (“In addition”, “Even so”) and the longer framing.",
  casual: "Takes the plainer connectives (“Plus”, “But”, “So”) and admits contractions.",
  neutral: "Uses the middle set of connectives. Formality still decides contractions.",
};

export function HumanizerPage() {
  const storeDocuments = usePreferencesStore((state) => state.privacy.storeDocuments);
  const { toast } = useToast();
  const guard = useQuota("humanizer");

  const [input, setInput] = useState(() =>
    storeDocuments ? readJson<string>(STORAGE_KEYS.humanizerInput, "") : "",
  );
  const [strength, setStrength] = useState(Math.round(DEFAULT_HUMANIZER_OPTIONS.strength * 100));
  const [formality, setFormality] = useState(Math.round(DEFAULT_HUMANIZER_OPTIONS.formality * 100));
  const [creativity, setCreativity] = useState(Math.round(DEFAULT_HUMANIZER_OPTIONS.creativity * 100));
  const [tone, setTone] = useState<string>(DEFAULT_HUMANIZER_OPTIONS.tone);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [undoText, setUndoText] = useState<string | null>(null);
  const [showEdits, setShowEdits] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const lastSaved = useRef(input);

  useEffect(() => () => abortRef.current?.abort(), []);

  const words = countWords(input);
  const tooShort = words < HUMANIZER_MIN_WORDS;
  const tooLong = words > MAX_WORDS;
  const running = run.status === "running";
  const result = run.status === "done" ? run.result : null;
  const bucket = toneBucket(tone);
  const contractions = allowsContractions(formality / 100, tone);

  const sentenceCount = useMemo(() => splitSentences(input).length, [input]);

  useEffect(() => {
    if (!storeDocuments || input === lastSaved.current) return;
    const timer = setTimeout(() => {
      lastSaved.current = input;
      writeJson(STORAGE_KEYS.humanizerInput, input);
    }, 700);
    return () => clearTimeout(timer);
  }, [input, storeDocuments]);

  const rewrite = useCallback(
    async (options: { strength: number; tone: string; formality: number; creativity: number }) => {
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
      const source = input;
      setRun({ status: "running", phase: "preparing" });

      try {
        const next = await humanizeText(source, {
          ...options,
          signal: controller.signal,
          onPhase: (phase) => {
            if (abortRef.current === controller) setRun({ status: "running", phase });
          },
        });
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        setRun({ status: "done", result: next, input: source });
        guard.record(words);

        setNotice(null);
        toast({
          title: next.changes.length === 0 ? "Nothing to change" : "Rewrite ready",
          description:
            next.changes.length === 0
              ? "The style pass found no stock phrasing or clipped rhythm in this text, so it came back as it was."
              : `${next.changes.length} edits · reading ease ${next.readabilityBefore} → ${next.readabilityAfter}. Check it against your own words.`,
          variant: next.changes.length === 0 ? "warning" : "success",
        });
      } catch (error) {
        if (abortRef.current !== controller) return;
        abortRef.current = null;
        const serviceError = toServiceError(error);
        setRun({ status: "error", error: serviceError });
        toast({ title: "Rewrite stopped", description: serviceError.message, variant: "error" });
      }
    },
    [input, guard, toast],
  );

  const currentOptions = () => ({
    strength: strength / 100,
    tone,
    formality: formality / 100,
    creativity: creativity / 100,
  });

  function start() {
    void rewrite(currentOptions());
  }

  function handleInput(value: string) {
    setInput(value);
    if (undoText !== null) setUndoText(null);
  }

  useKeyboardShortcuts({ onAnalyze: start, enabled: !running && !tooShort && !tooLong });

  function cancel() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setRun({ status: "idle" });
    setNotice("Rewrite cancelled. Your text is still here.");
  }

  async function copyOutput() {
    if (!result) return;
    if (!navigator.clipboard?.writeText) {
      setNotice(
        "This browser does not let the page write to your clipboard. Select the rewrite and copy it yourself.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(result.after);
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
    setInput(result.after);
    setNotice("The rewrite is now in the input box, so you can run it through again.");
  }

  function restoreInput() {
    if (undoText === null) return;
    setInput(undoText);
    setUndoText(null);
    setNotice(null);
  }

  function loadStiffExample() {
    setUndoText(input.trim().length > 0 ? input : null);
    setInput(SAMPLE_HUMANIZER_INPUT);
    setRun({ status: "idle" });
    setNotice("Loaded the stiff sample the humanizer is built to smooth out.");
  }

  function importDocument(picked: StoredDocument) {
    setUndoText(input.trim().length > 0 ? input : null);
    setInput(picked.text);
    setRun({ status: "idle" });
    setNotice(`Loaded “${picked.title}” from your saved documents.`);
  }

  return (
    <>
      <PageHeader
        title="AI Humanizer"
        description="Turn stiff, templated prose into natural readable writing — and see each edit it made."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Humanizer" }]}
        actions={
          <>
            <Badge variant="outline" size="sm">
              Works on this device
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
              label="Before"
              role="your text"
              value={input}
              onChange={handleInput}
              placeholder="Paste the text you want to read more naturally — at least five words. It stays on this device."
              toolbar={
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
                    Import
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={loadStiffExample}>
                    <Sparkles className="size-3.5" aria-hidden />
                    Sample
                  </Button>
                </>
              }
            />

            <TextPane
              label="After"
              role="rewritten text"
              value={result?.after ?? ""}
              placeholder="Your rewrite appears here."
              empty={
                <EmptyState
                  compact
                  icon={Wand2}
                  title="No rewrite yet"
                  description="The style pass runs in this browser. It varies sentence length, trims stock transitions and prefers plain wording."
                />
              }
              toolbar={
                result && result.changes.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEdits((value) => !value)}
                  >
                    {showEdits ? "Whole rewrite" : "Each edit"}
                  </Button>
                ) : undefined
              }
              body={
                result ? (
                  showEdits && result.changes.length > 0 ? (
                    <div className="min-h-[18rem] flex-1 space-y-3 overflow-auto px-5 py-4">
                      {result.changes.map((change, index) => (
                        <div
                          key={`${change.sentenceIndex}-${index}`}
                          className="rounded-lg border border-border bg-surface-sunken px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="info" size="xs">
                              {CHANGE_KIND[change.kind] ?? change.kind}
                            </Badge>
                            <span className="text-2xs text-muted-foreground tabular">
                              sentence {change.sentenceIndex + 1} of{" "}
                              {splitSentences(result.before).length}
                            </span>
                            <span className="ml-auto text-2xs text-muted-foreground">
                              {change.note}
                            </span>
                          </div>
                          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground line-through decoration-error/40">
                            {change.original}
                          </p>
                          <p className="mt-1 flex gap-1.5 text-[0.9375rem] leading-[1.7] text-foreground">
                            <ArrowRight className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden />
                            <span>{change.revised}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="min-h-[18rem] flex-1 overflow-auto whitespace-pre-wrap px-5 py-4 text-[0.9375rem] leading-[1.7] text-foreground">
                      {result.after}
                    </p>
                  )
                ) : undefined
              }
            />
          </div>

          {result ? (
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">What changed</CardTitle>
                <Badge variant={result.changes.length === 0 ? "warning" : "success"} size="xs">
                  {result.changes.length === 0
                    ? "No edits were needed"
                    : `${result.changes.length} edits, ${splitSentences(result.after).length} sentences`}
                </Badge>
                <p className="ml-auto text-2xs text-muted-foreground">
                  {formatNumber(countWords(result.before))} → {formatNumber(countWords(result.after))} words
                </p>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                {describeHumanizerRun(result)}
              </p>

              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Reading ease"
                  value={`${result.readabilityBefore} → ${result.readabilityAfter}`}
                  note={
                    result.readabilityDelta === 0
                      ? "No change in the measured ease."
                      : result.readabilityDelta > 0
                        ? `${result.readabilityDelta.toFixed(1)} easier than your text.`
                        : `${Math.abs(result.readabilityDelta).toFixed(1)} harder than your text.`
                  }
                />
                <Metric
                  label="Sentence-length spread"
                  value={`${result.rhythmBefore} → ${result.rhythmAfter}`}
                  note={
                    result.rhythmAfter === result.rhythmBefore
                      ? "The rhythm came back as uneven as it was."
                      : result.rhythmAfter > result.rhythmBefore
                        ? "More variation between long and short sentences."
                        : "Less variation between long and short sentences."
                  }
                />
                <Metric
                  label="Average sentence"
                  value={`${formatNumber(Math.round(countWords(result.after) / Math.max(1, splitSentences(result.after).length)))} words`}
                  note={`Your text averaged ${formatNumber(Math.round(countWords(result.before) / Math.max(1, splitSentences(result.before).length)))}.`}
                />
              </dl>

              {run.status === "done" && input !== run.input ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/35 bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                  The input has changed since this rewrite ({formatNumber(words)} words now,{" "}
                  {formatNumber(countWords(run.input))} when it ran). The edits above describe the text
                  it was given.
                </p>
              ) : null}
            </Card>
          ) : null}

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-2xs leading-relaxed text-muted-foreground">{HUMANIZER_NOTE}</p>
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
                {running ? `${PHASE_LABEL[run.phase]}…` : "Humanize"}
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
                  onClick={replaceInput}
                  disabled={!result}
                >
                  <Replace className="size-3.5" aria-hidden />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="col-span-2"
                  onClick={start}
                  disabled={running || tooShort || tooLong}
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  Run again with these settings
                </Button>
              </div>

              <p className="text-2xs leading-relaxed text-muted-foreground">
                {tooShort ? (
                  <>
                    Needs at least {HUMANIZER_MIN_WORDS} words. This has {formatNumber(words)}.
                  </>
                ) : tooLong ? (
                  <>
                    {formatNumber(words - MAX_WORDS)} words over the {formatNumber(MAX_WORDS)} word
                    limit. Work through a document a section at a time.
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
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-sm">Transformation controls</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <Range
                id="humanizer-strength"
                label="Strength"
                value={strength}
                onChange={setStrength}
                note={
                  strength === 0
                    ? "0 leaves your text exactly as it is."
                    : strength <= 30
                      ? "Light: only the wordiest phrases are touched."
                      : strength <= 70
                        ? "Balanced: wordiness, connectives and clipped rhythm all get attention."
                        : "Strong: expect sentences to be split and rejoined."
                }
              />

              <div>
                <Label htmlFor="humanizer-tone">Tone</Label>
                <Select
                  id="humanizer-tone"
                  className="mt-1"
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                >
                  {HUMANIZER_TONES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry[0]!.toUpperCase() + entry.slice(1)}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                  <span className="capitalize">{bucket}</span> connectives — {TONE_EFFECT[bucket]}
                </p>
              </div>

              <Range
                id="humanizer-formality"
                label="Formality"
                value={formality}
                onChange={setFormality}
                note={
                  contractions
                    ? formality < 60
                      ? "Below 60, so contracted forms (“don't”, “it's”) are allowed in."
                      : "Formality is 60 or above, which normally keeps full forms — but a casual tone overrides it, so contractions are allowed."
                    : "60 or above, so the rewrite keeps full forms (“do not”, “it is”). Lower it, or pick a casual tone, to let contractions in."
                }
              />

              <Range
                id="humanizer-creativity"
                label="Creativity"
                value={creativity}
                onChange={setCreativity}
                note={
                  creativity <= 40
                    ? "Keeps your sentence openings as they are."
                    : "Allowed to vary a sentence that starts like the one before it."
                }
              />

              <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
                <Type className="mt-px size-3.5 shrink-0" aria-hidden />
                The style rules are written for English prose. Text in another language comes back
                almost unchanged rather than being rewritten by rules that do not apply to it.
              </p>
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
                  title="What the pass does"
                  description="It trims stock phrasing, swaps templated connectives, splits overlong sentences and rejoins clipped ones — then reports the reading ease and rhythm it measured."
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={loadStiffExample}>
                      <Sparkles className="size-3.5" aria-hidden />
                      Load the stiff sample
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

interface RangeProps {
  id: string;
  label: string;
  value: number;
  onChange(value: number): void;
  note: string;
}

function Range({ id, label, value, onChange, note }: RangeProps) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        <span className="ml-auto font-normal tabular text-muted-foreground">{value}%</span>
      </Label>
      <Slider
        id={id}
        className="mt-1"
        min={0}
        max={100}
        step={5}
        value={[value]}
        aria-label={label}
        onValueChange={([next]) => onChange(next ?? value)}
      />
      <p className="text-2xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold tabular")}>{value}</dd>
      <dd className="text-2xs leading-relaxed text-muted-foreground">{note}</dd>
    </div>
  );
}

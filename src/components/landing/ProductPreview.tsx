import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Info, LoaderCircle, Sparkles } from "lucide-react";
import { ScoreRing } from "@/components/charts/ScoreRing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LANDING_DEMO_TEXT } from "@/data/landingDemo";
import { countWords, normalizeText } from "@/lib/text";
import { detectText } from "@/services/detectorService";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import {
  CLASSIFICATION_DESCRIPTION,
  CLASSIFICATION_LABEL,
  CONFIDENCE_LABEL,
  DETECTION_DISCLAIMER_SHORT,
  cn,
  formatPercent,
} from "@/lib/utils";
import type { AnalysisPhase, Classification, DetectionResult, SentenceAnalysis } from "@/types";

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  preparing: "Preparing text",
  normalizing: "Normalising",
  analyzing: "Analyzing patterns",
  scoring: "Scoring sentences",
  reporting: "Generating report",
};

/** Static class map: Tailwind cannot see dynamically interpolated utility names. */
const SIGNAL_BG: Record<SentenceAnalysis["signal"], string> = {
  ai: "bg-signal-ai-bg",
  human: "bg-signal-human-bg",
  mixed: "bg-signal-mixed-bg",
  neutral: "bg-signal-neutral-bg",
};

const SIGNAL_TEXT: Record<SentenceAnalysis["signal"], string> = {
  ai: "text-signal-ai",
  human: "text-signal-human",
  mixed: "text-signal-mixed",
  neutral: "text-signal-neutral",
};

const BREAKDOWN_ORDER: Classification[] = [
  "ai_generated",
  "ai_generated_refined",
  "human_refined",
  "human_written",
];

/**
 * Interactive detector demo used in the landing hero and as the no-backend
 * demo mode: it runs the real local engine over a sample document.
 */
export function ProductPreview({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [text, setText] = useState(LANDING_DEMO_TEXT);
  const [phase, setPhase] = useState<AnalysisPhase | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [selected, setSelected] = useState<SentenceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const running = phase !== null;

  const analyze = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setSelected(null);
    setResult(null);
    setPhase("preparing");
    try {
      const detection = await detectText(text, {
        signal: controller.signal,
        onPhase: setPhase,
      });
      setResult(detection);
      setSelected(detection.sentences.find((sentence) => sentence.flagged) ?? null);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setPhase(null);
      }
    }
  }, [text]);

  // Offsets from the engine address the normalized text, so the rendered copy is
  // normalized too — otherwise highlighted spans drift on edited input.
  const segments = useMemo(() => {
    if (!result) return null;
    const source = normalizeText(text);
    const out: Array<{ value: string } | { sentence: SentenceAnalysis }> = [];
    let cursor = 0;
    for (const sentence of result.sentences) {
      if (sentence.start > cursor) out.push({ value: source.slice(cursor, sentence.start) });
      out.push({ sentence });
      cursor = sentence.end;
    }
    if (cursor < source.length) out.push({ value: source.slice(cursor) });
    return out;
  }, [result, text]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-overlay",
        compact && "shadow-raised",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
        </span>
        <p className="ml-1.5 truncate text-2xs font-medium text-muted-foreground">
          VeriWrite — AI Detector workspace
        </p>
        <Badge variant="outline" size="xs" className="ml-auto hidden sm:inline-flex">
          Local engine
        </Badge>
      </div>

      <div className={cn("grid gap-0", compact ? "lg:grid-cols-[1fr]" : "lg:grid-cols-[1.35fr_1fr]")}>
        {/* Editor / analysed text */}
        <div className="flex min-w-0 flex-col border-border lg:border-r">
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
            <Button variant="ghost" size="sm" className="text-2xs" disabled>
              Paste
            </Button>
            <Button variant="ghost" size="sm" className="text-2xs" disabled>
              Upload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-2xs"
              onClick={() => {
                setResult(null);
                setSelected(null);
                setText(LANDING_DEMO_TEXT);
              }}
            >
              Reset
            </Button>
          </div>

          <div className="relative min-h-[15rem] flex-1">
            {!result && !running && (
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                aria-label="Sample text to analyse"
                spellCheck={false}
                className="h-full min-h-[15rem] w-full resize-none bg-transparent px-4 py-3.5 text-[0.8125rem] leading-[1.75] text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Paste your text here…"
              />
            )}

            {running && (
              <div className="space-y-2.5 px-4 py-4" aria-hidden="true">
                {[92, 78, 88, 64, 96, 71].map((width, index) => (
                  <Skeleton
                    key={index}
                    className="h-3 rounded-xs"
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
            )}

            {result && !running && (
              <div className="max-h-[19rem] overflow-y-auto whitespace-pre-wrap px-4 py-3.5 text-[0.8125rem] leading-[1.85]">
                {segments?.map((segment, index) => {
                  if ("value" in segment) {
                    return (
                      <span key={`gap-${index}`} className="text-foreground/90">
                        {segment.value}
                      </span>
                    );
                  }
                  const { sentence } = segment;
                  const isActive = selected?.id === sentence.id;
                  return (
                    <button
                      key={sentence.id}
                      type="button"
                      onClick={() => setSelected(isActive ? null : sentence)}
                      className={cn(
                        "rounded-xs px-0.5 text-left outline-none transition-colors",
                        SIGNAL_BG[sentence.signal],
                        "underline decoration-[3/4] underline-offset-4",
                        isActive && "ring-1 ring-inset ring-primary",
                        selected && !isActive && "opacity-70",
                        "hover:underline hover:decoration-[color:var(--signal-ai-line)]",
                      )}
                      aria-label={`Sentence ${sentence.index + 1}, estimated ${formatPercent(sentence.aiProbability)} AI likelihood`}
                    >
                      {sentence.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface px-4 py-2 text-2xs text-muted-foreground tabular">
            <span>{countWords(text)} words</span>
            <span>{text.length} characters</span>
            <span className="hidden sm:inline">
              {result ? `${result.sentences.length} sentences` : "Run analysis for sentence detail"}
            </span>
            <span className="ml-auto">
              {running ? PHASE_LABEL[phase as AnalysisPhase] : result ? "Analysis complete" : "Ready to analyze"}
            </span>
          </div>

          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <Button
              size="sm"
              onClick={analyze}
              loading={running}
              disabled={text.trim().length === 0}
              className="min-w-[9.5rem]"
            >
              {!running && <Sparkles className="size-3.5" aria-hidden="true" />}
              {running ? "Analyzing…" : "Analyze Text"}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => navigate("/detector")}
              className="hidden sm:inline-flex"
            >
              Open full tool
            </Button>
          </div>
        </div>

        {/* Analysis panel — entry animations only: an exit transition gating the mount
            would hide the result whenever the tab is throttled or animations paused. */}
        <div className="min-w-0 bg-surface/60 p-4">
          {running ? (
            <div
              className="space-y-3"
              role="status"
              aria-live="polite"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                {PHASE_LABEL[phase as AnalysisPhase]}
              </span>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-3 w-2/3 rounded-xs" />
              <Skeleton className="h-3 w-1/2 rounded-xs" />
            </div>
          ) : !result ? (
            <div className="flex h-full min-h-[16rem] flex-col items-start justify-center gap-2 rounded-lg border border-dashed border-border p-5">
              <p className="text-sm font-semibold text-foreground">Results appear here</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The demo runs the bundled local engine in your browser. Nothing is uploaded.
              </p>
              {error && <p className="text-xs text-error">{error}</p>}
            </div>
          ) : (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
                <div className="flex items-center gap-4">
                  <ScoreRing
                    value={result.aiProbability}
                    size={104}
                    strokeWidth={8}
                    label="AI likelihood"
                    animated={!reducedMotion}
                  />
                  <div className="min-w-0">
                    <p className="text-2xs uppercase tracking-[0.07em] text-muted-foreground">
                      Estimated likelihood of AI involvement
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-foreground">
                      {CLASSIFICATION_LABEL[result.classification]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {CONFIDENCE_LABEL[result.confidence]}
                    </p>
                    <p className="mt-2 text-xs tabular text-muted-foreground">
                      Human {formatPercent(result.humanProbability)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    Classification breakdown
                  </p>
                  <ul className="space-y-2">
                    {BREAKDOWN_ORDER.map((key) => {
                      const value = result.breakdown[key];
                      return (
                        <li key={key}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[0.6875rem] text-foreground">
                              {CLASSIFICATION_LABEL[key]}
                            </span>
                            <span className="text-[0.6875rem] tabular text-muted-foreground">
                              {formatPercent(value)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              initial={reducedMotion ? false : { width: 0 }}
                              animate={{ width: `${value}%` }}
                              transition={{ duration: 0.45, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{
                                background:
                                  key === "human_written"
                                    ? "var(--signal-human)"
                                    : key === "ai_generated"
                                      ? "var(--signal-ai)"
                                      : "var(--signal-mixed)",
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {selected ? (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-card">
                    <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                      <Info className="size-3.5" aria-hidden="true" />
                      Why sentence {selected.index + 1} reads this way
                    </p>
                    <p className="mt-2 line-clamp-3 text-xs italic leading-relaxed text-foreground/80">
                      “{selected.text}”
                    </p>
                    <ul className="mt-2.5 space-y-1.5">
                      {selected.signals.length === 0 && (
                        <li className="text-xs text-muted-foreground">
                          No strong signal above the reporting threshold.
                        </li>
                      )}
                      {selected.signals.map((signal) => (
                        <li key={signal.name} className="flex gap-2 text-xs leading-relaxed">
                          <Check
                            className={cn("mt-0.5 size-3.5 shrink-0", SIGNAL_TEXT[selected.signal])}
                            aria-hidden="true"
                          />
                          <span className="text-muted-foreground">{signal.explanation}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2.5 border-t border-border pt-2 text-2xs tabular text-muted-foreground">
                      Sentence estimate {formatPercent(selected.aiProbability)} ·{" "}
                      {CONFIDENCE_LABEL[selected.confidence].toLowerCase()}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground">
                    Select a highlighted sentence to see the signals behind its estimate.
                  </p>
                )}

                <p className="text-2xs leading-relaxed text-muted-foreground">
                  {CLASSIFICATION_DESCRIPTION[result.classification]}{" "}
                  {DETECTION_DISCLAIMER_SHORT}
                </p>
              </motion.div>
            )}
        </div>
      </div>
    </div>
  );
}

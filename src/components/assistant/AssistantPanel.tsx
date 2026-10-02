import { useEffect, useRef, useState } from "react";
import { Copy, Eraser, Sparkles, Square, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useQuota } from "@/hooks/useQuota";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { toServiceError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ASSISTANT_ACTIONS, ASSISTANT_TONES } from "@/lib/tools/assistantEngine";
import type { AssistantActionId } from "@/lib/tools/assistantEngine";
import { countWords } from "@/lib/text";
import { getAssistantCapabilities, streamAssistant } from "@/services/assistantService";
import type { AssistantStreamMeta } from "@/services/assistantService";
import type { LanguageCode, ServiceError } from "@/types";

/** One request and the reply it produced, kept in the order they ran. */
interface ThreadEntry {
  id: string;
  action: AssistantActionId;
  label: string;
  /** What the action was pointed at, so the thread says what it read. */
  targetLabel: string;
  prompt: string | null;
  text: string;
  basis: string;
  requiresModel: boolean;
  insertText: string | null;
  streaming: boolean;
  error: ServiceError | null;
}

export interface AssistantPanelProps {
  /** The whole document; used when nothing is selected. */
  documentText: string;
  language?: LanguageCode;
  /** Read when a request runs, so a stale selection is never sent. */
  getSelection?: () => string;
  /** Writes the reply back into the document at the caret. */
  onInsert?: (text: string) => void;
  className?: string;
}

/**
 * The assistant works on text that already exists. Which actions can run is decided by
 * the service, not by this component, so a build with no model attached shows the same
 * six actions it actually performs.
 */
export function AssistantPanel({
  documentText,
  language,
  getSelection,
  onInsert,
  className,
}: AssistantPanelProps) {
  const capabilities = getAssistantCapabilities();
  const { toast } = useToast();
  const guard = useQuota("writer");
  const [action, setAction] = useState<AssistantActionId>("summarize");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState(ASSISTANT_TONES[0]?.id ?? "neutral");
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [thread]);

  const selectedText = running ? "" : (getSelection?.() ?? "");
  const needsPrompt = action === "ask";
  const needsText = action !== "ask";
  const nothingToWorkOn = needsText && documentText.trim().length === 0 && selectedText.trim().length === 0;
  const blockedByPrompt = needsPrompt && prompt.trim().length === 0;
  const actionMeta = ASSISTANT_ACTIONS.find((entry) => entry.id === action);
  const modelNeeded = capabilities.needsModel.includes(action) && capabilities.engine === "local";

  async function run() {
    if (running || modelNeeded) return;
    const selection = getSelection?.() ?? "";
    const usesSelection = selection.trim().length > 0;
    const targetWords = countWords(usesSelection ? selection : documentText);
    if (needsText && targetWords === 0) return;
    if (needsPrompt && prompt.trim().length === 0) return;

    const quota = guard.check(targetWords);
    if (!quota.allowed) {
      toast({
        title: "Run not started",
        description: quota.reason ?? "That run is over your plan's limit.",
        variant: "warning",
      });
      return;
    }

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: ThreadEntry = {
      id,
      action,
      label: actionMeta?.label ?? action,
      targetLabel: usesSelection
        ? `the selection (${targetWords.toLocaleString("en-US")} words)`
        : `the document (${targetWords.toLocaleString("en-US")} words)`,
      prompt: needsPrompt ? prompt.trim() : null,
      text: "",
      basis: "",
      requiresModel: false,
      insertText: null,
      streaming: true,
      error: null,
    };
    setThread((current) => [...current, entry]);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const patch = (changes: Partial<ThreadEntry>) =>
      setThread((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));

    let collected = "";
    // Held in an object: a `let` only ever assigned from the callback is narrowed to never.
    const meta: { current: AssistantStreamMeta | null } = { current: null };

    try {
      for await (const chunk of streamAssistant(
        {
          action,
          documentText,
          selection: usesSelection ? selection : undefined,
          language,
          tone: action === "tone" ? tone : undefined,
          prompt: needsPrompt ? prompt.trim() : undefined,
        },
        {
          signal: controller.signal,
          onMeta: (next) => {
            meta.current = next;
            patch({ basis: next.basis, requiresModel: next.requiresModel, insertText: next.insertText });
          },
        },
      )) {
        if (controller.signal.aborted) break;
        collected += chunk.endsWith("\n") ? chunk : `${chunk} `;
        patch({ text: collected });
      }
      patch({ streaming: false, basis: meta.current?.basis ?? "" });
      // Only a reply that reached the end of its stream is charged; a stop costs nothing.
      if (!controller.signal.aborted) guard.record(targetWords);
    } catch (error) {
      const serviceError = toServiceError(error);
      patch({ streaming: false, error: serviceError, text: collected });
      toast({ title: "Assistant stopped", description: serviceError.message, variant: "error" });
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function stop() {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setThread((current) =>
      current.map((item) => (item.streaming ? { ...item, streaming: false, basis: item.basis || "cancelled" } : item)),
    );
    setRunning(false);
  }

  function copy(text: string) {
    if (!navigator.clipboard?.writeText) {
      toast({ title: "Copy blocked", description: "This browser will not let the page write to the clipboard. Select the text and copy it yourself.", variant: "warning" });
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied", variant: "success" }),
      () => toast({ title: "The browser refused the copy", variant: "warning" }),
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            Writing assistant
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
            {capabilities.engine === "backend"
              ? "Connected to the writing service. Replies stream as they arrive."
              : "Works on your own text with the built-in tools. No language model is attached, so it will not invent sentences."}
          </p>
        </div>
        {thread.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setThread([])} disabled={running}>
            <Eraser className="size-3.5" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>

      <div role="group" aria-label="Assistant action" className="flex flex-wrap gap-1.5">
        {ASSISTANT_ACTIONS.map((entry) => {
          const disabled = (capabilities.needsModel.includes(entry.id) && capabilities.engine === "local") || running;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setAction(entry.id)}
              aria-pressed={action === entry.id}
              disabled={disabled}
              title={
                disabled && capabilities.engine === "local"
                  ? "Needs a connected language model"
                  : entry.description
              }
              className={cn(
                "rounded-md border px-2.5 py-1 text-2xs font-medium transition-colors",
                action === entry.id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-55 hover:text-muted-foreground",
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <p className="text-2xs leading-relaxed text-muted-foreground">{actionMeta?.description}</p>

      {needsPrompt ? (
        <div className="space-y-1">
          <Label htmlFor="assistant-prompt" className="text-2xs">
            Your question
          </Label>
          <Textarea
            id="assistant-prompt"
            rows={2}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="What do you want to know about this passage?"
          />
        </div>
      ) : null}

      {action === "tone" ? (
        <div className="flex items-center gap-2">
          <Label htmlFor="assistant-tone" className="shrink-0 text-2xs">
            Tone
          </Label>
          <Select
            id="assistant-tone"
            className="h-8 w-auto flex-1 text-2xs"
            value={tone}
            onChange={(event) => setTone(event.target.value)}
          >
            {ASSISTANT_TONES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {modelNeeded ? (
        <p className="rounded-lg border border-warning/35 bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
          {action === "ask"
            ? "Answering a question means generating sentences that are not in your document. This build ships no model for that."
            : "Continuing the prose means generating sentences that are not in your document. This build ships no model for that."}{" "}
          Point <code className="font-mono text-3xs">VITE_API_BASE_URL</code> at a writing service to enable it.
        </p>
      ) : null}

      {nothingToWorkOn ? (
        <p className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
          Nothing to work on yet. Write or paste something, or select a passage to limit the request to it.
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" className="flex-1" onClick={() => void run()} disabled={running || modelNeeded || blockedByPrompt || nothingToWorkOn}>
          {running ? <Spinner size="sm" /> : <Sparkles className="size-3.5" aria-hidden />}
          {running ? "Working…" : `Run ${actionMeta?.label ?? "action"}`}
        </Button>
        {running ? (
          <Button type="button" variant="ghost" size="sm" onClick={stop}>
            <Square className="size-3.5" aria-hidden />
            Stop
          </Button>
        ) : null}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5" aria-live="polite">
        {thread.length === 0 ? (
          <EmptyState
            compact
            icon={Sparkles}
            title="No requests yet"
            description="Pick an action above. Everything the assistant returns is built from the text in this document."
          />
        ) : null}
        {thread.map((entry) => (
          <AssistantReplyCard
            key={entry.id}
            entry={entry}
            onCopy={copy}
            onInsert={onInsert ? (text) => onInsert(text) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function AssistantReplyCard({
  entry,
  onCopy,
  onInsert,
}: {
  entry: ThreadEntry;
  onCopy: (text: string) => void;
  onInsert?: (text: string) => void;
}) {
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-2xs font-semibold tracking-tight">{entry.label}</span>
        <span className="text-3xs text-muted-foreground">· {entry.targetLabel}</span>
        {entry.streaming ? <Badge variant="outline" size="sm">streaming</Badge> : null}
        {entry.requiresModel ? <Badge variant="warning" size="sm">needs a model</Badge> : null}
      </div>
      {entry.prompt ? (
        <p className="mt-1 border-l-2 border-border pl-2 text-2xs italic text-muted-foreground">{entry.prompt}</p>
      ) : null}
      {entry.error ? (
        <p className="mt-1.5 text-2xs leading-relaxed text-error">
          {entry.error.message}
          {entry.error.hint ? ` ${entry.error.hint}` : ""}
        </p>
      ) : null}
      {entry.text ? (
        <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-2xs leading-relaxed text-foreground">
          {entry.text}
          {entry.streaming ? <span className="text-muted-foreground">▍</span> : null}
        </pre>
      ) : entry.streaming ? (
        <p className="mt-1.5 text-2xs text-muted-foreground">Waiting for the first words…</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {entry.basis ? (
          <span className="text-3xs text-muted-foreground">From {entry.basis}.</span>
        ) : null}
        {entry.text && !entry.error ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => onCopy(entry.text)}>
              <Copy className="size-3" aria-hidden />
              Copy
            </Button>
            {onInsert && entry.insertText ? (
              <Button type="button" variant="outline" size="sm" onClick={() => onInsert(entry.insertText ?? "")}>
                Insert into document
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Floating form of the panel: a corner trigger, a card on desktop and a bottom sheet on
 * small screens, where a side panel would cover the editor the request just read.
 */
export function AssistantDock(props: AssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const desktop = useIsDesktop();

  useEffect(() => {
    if (!desktop) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktop, open]);

  if (!desktop) {
    return (
      <>
        <AssistantTrigger open={open} onClick={() => setOpen(true)} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="gap-3 p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Writing assistant</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AssistantPanel {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      <AssistantTrigger open={open} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <Card className="fixed right-4 z-40 flex h-[min(30rem,calc(100svh-11rem))] w-[22rem] max-w-[calc(100vw-2rem)] flex-col p-3 shadow-overlay bottom-[calc(8.25rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6 lg:h-[min(34rem,80svh)]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant panel"
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
          <AssistantPanel {...props} className="pt-5" />
        </Card>
      ) : null}
    </>
  );
}

function AssistantTrigger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label="Writing assistant"
      className={cn(
        "fixed right-4 z-40 flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-2xs font-medium shadow-overlay transition-colors bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6",
        open ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-surface-sunken",
      )}
    >
      <Sparkles className="size-4" aria-hidden />
      <span className="sm:hidden sr-only">Assistant</span>
      <span className="hidden sm:inline">Assistant</span>
    </button>
  );
}

/** The panel inside a card column, for pages that dock it beside an editor. */
export function AssistantColumn(props: AssistantPanelProps) {
  return (
    <Card className="flex h-full min-h-[30rem] flex-col p-4">
      <AssistantPanel {...props} />
    </Card>
  );
}

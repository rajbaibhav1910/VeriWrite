import { ApiError, apiUrl, apiRequest, backendConfigured } from "@/lib/api";
import { requireRecord, requireString } from "@/lib/service";
import {
  ASSISTANT_ACTIONS,
  chunkAssistantText,
  runAssistantAction,
} from "@/lib/tools/assistantEngine";
import type { AssistantActionId, AssistantReply, AssistantRequest } from "@/lib/tools/assistantEngine";

export { ASSISTANT_ACTIONS, runAssistantAction };
export type { AssistantActionId, AssistantReply, AssistantRequest };

export interface AssistantCapabilities {
  engine: "backend" | "local";
  /** Actions the current build can perform without inventing new prose. */
  available: AssistantActionId[];
  /** Actions that need a connected language model. */
  needsModel: AssistantActionId[];
  streaming: boolean;
}

export function getAssistantCapabilities(): AssistantCapabilities {
  return {
    engine: backendConfigured() ? "backend" : "local",
    available: ASSISTANT_ACTIONS.filter((action) => action.local).map((action) => action.id),
    needsModel: ASSISTANT_ACTIONS.filter((action) => !action.local).map((action) => action.id),
    streaming: true,
  };
}

function guardReply(request: AssistantRequest, payload: unknown): AssistantReply {
  const record = requireRecord(payload, "assistant");
  const text = requireString(record, "text", "assistant");
  return {
    action: request.action,
    text,
    requiresModel: record.requiresModel === true,
    basis: typeof record.basis === "string" ? record.basis : "connected writing service",
    // A backend that does not name the insertable part gets no insert button rather
    // than a guess that pastes commentary into the document.
    insertText: typeof record.insertText === "string" && record.insertText ? record.insertText : null,
  };
}

async function runRemotely(request: AssistantRequest): Promise<AssistantReply> {
  const payload = await apiRequest<unknown>("/api/assistant", {
    method: "POST",
    body: {
      action: request.action,
      text: request.documentText,
      selection: request.selection,
      language: request.language,
      tone: request.tone,
      prompt: request.prompt,
    },
  });
  return guardReply(request, payload);
}

export async function runAssistant(request: AssistantRequest): Promise<AssistantReply> {
  return backendConfigured() ? runRemotely(request) : runAssistantAction(request);
}

const CHUNK_PAUSE_MS = 24;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export interface AssistantStreamMeta extends AssistantStreamInsert {
  basis: string;
  requiresModel: boolean;
}

/** What the panel may offer to insert, kept separate so a null is never guessed at. */
interface AssistantStreamInsert {
  insertText: string | null;
}

export interface AssistantStreamOptions {
  signal?: AbortSignal;
  /**
   * Runs before the first chunk with what the reply was built from, so the panel can
   * label its own basis instead of guessing one from the text.
   */
  onMeta?: (meta: AssistantStreamMeta) => void;
}

/**
 * One streaming interface for both paths: the backend replies as SSE lines, the local
 * engine replies in word groups. Callers only ever consume an async iterable.
 */
export async function* streamAssistant(
  request: AssistantRequest,
  options: AssistantStreamOptions = {},
): AsyncGenerator<string, void, undefined> {
  const { signal, onMeta } = options;

  if (!backendConfigured()) {
    const reply = runAssistantAction(request);
    onMeta?.({ basis: reply.basis, requiresModel: reply.requiresModel, insertText: reply.insertText });
    for (const chunk of chunkAssistantText(reply.text)) {
      if (signal?.aborted) return;
      yield chunk;
      await wait(CHUNK_PAUSE_MS);
    }
    return;
  }

  const response = await fetch(apiUrl("/api/assistant/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    credentials: "include",
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new ApiError(
      response.status === 429 ? "rate_limited" : response.status === 401 || response.status === 403 ? "auth" : "api",
      response.status === 429
        ? "You have hit the limit for this plan."
        : `The assistant service responded with ${response.status}.`,
      response.status === 429 ? "Upgrade your plan or wait for the monthly reset." : undefined,
      response.status,
    );
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let reported = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      const chunk = readStreamChunk(data);
      if (!reported) {
        reported = true;
        onMeta?.({
          basis: chunk.basis,
          requiresModel: chunk.requiresModel,
          insertText: chunk.insertText,
        });
      }
      if (chunk.text) yield chunk.text;
    }
  }
}

/**
 * A backend line is either bare text or a small JSON object. The shape is not
 * trusted: an unreadable payload contributes nothing rather than throwing the
 * reply away, and a missing basis is reported as one rather than invented.
 */
export function readStreamChunk(data: string): AssistantStreamMeta & { text: string } {
  if (!data.startsWith("{")) {
    return { text: data, basis: "connected writing service", requiresModel: false, insertText: null };
  }
  try {
    const record = JSON.parse(data) as Record<string, unknown>;
    return {
      text: typeof record.text === "string" ? record.text : "",
      basis: typeof record.basis === "string" && record.basis ? record.basis : "connected writing service",
      requiresModel: record.requiresModel === true,
      insertText: typeof record.insertText === "string" && record.insertText ? record.insertText : null,
    };
  } catch {
    return { text: "", basis: "connected writing service", requiresModel: false, insertText: null };
  }
}

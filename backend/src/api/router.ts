/**
 * The route table. Every path here is one the frontend already calls
 * (`src/services/documentService.ts`), and every response body is shaped by
 * `src/schemas/wire.ts` so the client's strict row parsers accept it.
 *
 * Two rules hold throughout:
 *
 *  - A row the client cannot label is not sent. That is why a document is refused when it
 *    names a tool this app does not have, rather than stored and dropped later as an
 *    "unreadable" row.
 *  - "Not there" and "the call failed" are different answers. A missing row is 404; a
 *    write that could not be recorded is 4xx/5xx with a message.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  applyCors,
  applySecurityHeaders,
  audit,
  readJsonBody,
  resolveUserId,
  sendEmpty,
  sendJson,
} from "./middleware.ts";
import { ruleFor, takeSlot } from "./rate-limit.ts";
import {
  BadRequest,
  NotFound,
  documentToWire,
  parseAnalysisBody,
  parseDetectBody,
  parseDocumentBody,
  parseHistoryQuery,
} from "../schemas/wire.ts";
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  listDocuments,
  mustGetDocument,
  patchDocument,
} from "../services/documents.ts";
import {
  clearHistory,
  deleteHistoryEntry,
  renameHistoryEntry,
  searchHistory,
} from "../services/history.ts";
import {
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
} from "../services/folders.ts";
import {
  duplicateAnalysisRecord,
  getAnalysisRecord,
  saveAnalysis,
} from "../services/analyses.ts";
import { getUsage } from "../services/usage.ts";
import { runDetection } from "../services/detection.ts";
import { modelChoice } from "../detector/model.ts";

type Handler = (ctx: Context) => void | Promise<void>;

interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  userId: string;
  /** The path segment after a prefix, already decoded: `/api/documents/:id`. */
  param(name: string): string;
  body(): Promise<unknown>;
}

/** `:name` in a pattern matches exactly one segment. */
const ROUTES: Array<{ method: string; pattern: RegExp; names: string[]; handler: Handler }> = [];

function route(method: string, path: string, handler: Handler): void {
  const names: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:[A-Za-z]+/g, (match) => {
      names.push(match.slice(1));
      return "([^/]+)";
    })}$`,
  );
  ROUTES.push({ method, pattern, names, handler });
}

/* ------------------------------------------------------------------- documents */

route("GET", "/api/documents", (ctx) => {
  const folderId = ctx.url.searchParams.get("folderId");
  const favorite = ctx.url.searchParams.get("favorite");
  sendJson(ctx.res, 200, {
    documents: listDocuments(ctx.userId, {
      // `none` is the unfiled list; no folder id can name it, so it is not looked up.
      folderId: folderId === null ? undefined : folderId === "none" ? null : folderId,
      tool: ctx.url.searchParams.get("tool") ?? undefined,
      favorite: favorite === "true" ? true : undefined,
      query: ctx.url.searchParams.get("query") ?? undefined,
    }),
  });
});

route("POST", "/api/documents", async (ctx) => {
  const document = createDocument(ctx.userId, parseDocumentBody(await ctx.body()));
  audit(ctx.userId, "document.create", ctx.req, { subject: document.id });
  sendJson(ctx.res, 201, { document });
});

route("GET", "/api/documents/:id", (ctx) => {
  // The client reads 404 here as "not there" and every other failure as a broken call.
  sendJson(ctx.res, 200, { document: documentToWire(mustGetDocument(ctx.userId, ctx.param("id"))) });
});

route("PATCH", "/api/documents/:id", async (ctx) => {
  const document = patchDocument(ctx.userId, ctx.param("id"), await ctx.body());
  audit(ctx.userId, "document.update", ctx.req, { subject: document.id });
  sendJson(ctx.res, 200, { document });
});

route("POST", "/api/documents/:id/duplicate", (ctx) => {
  const document = duplicateDocument(ctx.userId, ctx.param("id"));
  audit(ctx.userId, "document.duplicate", ctx.req, { subject: document.id });
  sendJson(ctx.res, 201, { document });
});

route("DELETE", "/api/documents/:id", (ctx) => {
  deleteDocument(ctx.userId, ctx.param("id"));
  audit(ctx.userId, "document.delete", ctx.req, { subject: ctx.param("id") });
  sendEmpty(ctx.res);
});

/* --------------------------------------------------------------------- folders */

route("GET", "/api/folders", (ctx) => {
  sendJson(ctx.res, 200, { folders: listFolders(ctx.userId) });
});

route("POST", "/api/folders", async (ctx) => {
  sendJson(ctx.res, 201, { folder: createFolder(ctx.userId, await ctx.body()) });
});

route("PATCH", "/api/folders/:id", async (ctx) => {
  sendJson(ctx.res, 200, { folder: renameFolder(ctx.userId, ctx.param("id"), await ctx.body()) });
});

route("DELETE", "/api/folders/:id", (ctx) => {
  deleteFolder(ctx.userId, ctx.param("id"));
  sendEmpty(ctx.res);
});

/* --------------------------------------------------------------------- history */

route("GET", "/api/history", (ctx) => {
  // `page=1&pageSize=1` is what the library snapshot asks for to get the count alone.
  sendJson(ctx.res, 200, searchHistory(ctx.userId, parseHistoryQuery(ctx.url.searchParams)));
});

route("DELETE", "/api/history", (ctx) => {
  const removed = clearHistory(ctx.userId);
  audit(ctx.userId, "history.clear", ctx.req, { removed });
  sendJson(ctx.res, 200, { removed });
});

route("PATCH", "/api/history/:id", async (ctx) => {
  sendJson(ctx.res, 200, {
    entry: renameHistoryEntry(ctx.userId, ctx.param("id"), await ctx.body()),
  });
});

route("DELETE", "/api/history/:id", (ctx) => {
  deleteHistoryEntry(ctx.userId, ctx.param("id"));
  sendEmpty(ctx.res);
});

/* ------------------------------------------------------------------- analyses */

route("POST", "/api/analyses", async (ctx) => {
  const record = saveAnalysis(ctx.userId, parseAnalysisBody(await ctx.body()));
  audit(ctx.userId, "analysis.save", ctx.req, { subject: record.entry.id });
  sendJson(ctx.res, 201, record);
});

route("GET", "/api/analyses/:id", (ctx) => {
  sendJson(ctx.res, 200, getAnalysisRecord(ctx.userId, ctx.param("id")));
});

route("POST", "/api/analyses/:id/duplicate", (ctx) => {
  const record = duplicateAnalysisRecord(ctx.userId, ctx.param("id"));
  audit(ctx.userId, "analysis.duplicate", ctx.req, { subject: record.entry.id });
  sendJson(ctx.res, 201, record);
});

/* --------------------------------------------------------------------- usage */

route("GET", "/api/usage", (ctx) => {
  sendJson(ctx.res, 200, getUsage(ctx.userId));
});

/* -------------------------------------------------------------------- detect */

/**
 * Detection is the product, and this route is the seam where its model runs: §37's stage
 * list — validation, normalization, language, segmentation, features, inference,
 * confidence, aggregation, explanation — executed by `services/detection.ts` on the model
 * this service selected. What is returned is the app's own result shape, which the client
 * validates field by field before it shows any of it.
 *
 * When no model is selected the answer is 501 with the reason, and when an upstream model
 * fails or under-answers it is 502 with that reason. A placeholder score is never sent:
 * the UI prints these numbers as measurements.
 */
route("POST", "/api/detect", async (ctx) => {
  const input = parseDetectBody(await ctx.body());
  const result = await runDetection(input.text, input.language);
  // No usage is recorded here: a run becomes a counters entry when it is saved, which is
  // `POST /api/analyses`, so a discarded try does not spend the month's allowance twice.
  sendJson(ctx.res, 200, result);
});

/* -------------------------------------------------------------------- health */

route("GET", "/api/health", (ctx) => {
  const choice = modelChoice();
  sendJson(ctx.res, 200, {
    status: "ok",
    // Which model answers detection, named as the selection states it — `null` when
    // detection is off, so a reader never has to guess from a status code.
    detectionModel: choice.id,
    detectionSource: choice.source,
  });
});

/* ------------------------------------------------------------------- dispatch */

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  applyCors(req, res);
  applySecurityHeaders(res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Max-Age", "600");
    res.statusCode = 204;
    res.end();
    return;
  }

  for (const entry of ROUTES) {
    if (entry.method !== req.method) continue;
    const match = entry.pattern.exec(url.pathname);
    if (!match) continue;
    const params = new Map<string, string>();
    entry.names.forEach((name, index) => params.set(name, decodeURIComponent(match[index + 1])));
    const userId = resolveUserId(req, res);

    // The body is never read from a request that has already been refused: the cap exists to
    // bound the work a caller can cause, and draining an oversized payload would be work.
    const slot = takeSlot(ruleFor(req.method, url.pathname), userId, req.socket.remoteAddress ?? null);
    if (!slot.allowed) {
      res.setHeader("Retry-After", String(slot.retryAfterSeconds));
      if (slot.firstRefusal) {
        audit(userId, "rate_limited", req, {
          subject: `${req.method} ${url.pathname}`,
          bucket: slot.rule.name,
          limit: slot.rule.limit,
          window_seconds: slot.rule.windowSeconds,
        });
      }
      sendJson(res, 429, {
        error: {
          code: "rate_limited",
          message: `No more than ${slot.rule.limit} ${slot.rule.name} ${slot.rule.limit === 1 ? "request" : "requests"} per ${slot.rule.windowSeconds} seconds.`,
          hint: `Try again in ${slot.retryAfterSeconds} second${slot.retryAfterSeconds === 1 ? "" : "s"}.`,
          retryAfterSeconds: slot.retryAfterSeconds,
        },
      });
      return;
    }

    const ctx: Context = {
      req,
      res,
      url,
      userId,
      param: (name) => params.get(name) ?? "",
      body: () => readJsonBody(req),
    };
    try {
      await entry.handler(ctx);
    } catch (error) {
      respondError(res, error);
    }
    return;
  }

  // An unknown path is 404 with a body; the client only reads the status, but a person
  // looking at a response should not have to guess which of the two it is.
  if (url.pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: { message: `This service has no route ${req.method} ${url.pathname}.` } });
    return;
  }
  sendEmpty(res, 404);
}

function respondError(res: ServerResponse, error: unknown): void {
  if (error instanceof NotFound) {
    sendJson(res, 404, { error: { message: error.message } });
    return;
  }
  if (error instanceof BadRequest) {
    sendJson(res, 400, { error: { message: error.message } });
    return;
  }
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status)
      : 0;
  if (status >= 400 && status < 600) {
    sendJson(res, status, {
      error: { message: error instanceof Error ? error.message : "The request failed." },
    });
    return;
  }
  // The engine's own refusals — a text too short or too long to measure — arrive as its
  // service error, which carries a code and a hint but no HTTP status. They are about the
  // reader's input, so they answer 400 with the same words the browser path would show.
  if (typeof error === "object" && error !== null && "code" in error) {
    const refused = error as { code: unknown; message: unknown; hint?: unknown };
    sendJson(res, 400, {
      error: {
        code: String(refused.code),
        message: refused instanceof Error ? refused.message : "The text cannot be measured.",
        hint: typeof refused.hint === "string" ? refused.hint : undefined,
      },
    });
    return;
  }
  // Anything else is this service's fault, and the message that explains it goes to the
  // log rather than to the browser, where it would be read as a claim about the text.
  console.error("[backend] unhandled", error);
  sendJson(res, 500, { error: { message: "The library service could not complete the request." } });
}

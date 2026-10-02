/**
 * The pieces every route needs: a bounded body read, the response helpers, the CORS
 * headers, and the identity a row belongs to.
 *
 * This is deliberately not a framework. `backend/` runs on Node's own HTTP module so it
 * starts with `node backend/src/index.ts` and nothing about it depends on a package that
 * may or may not be installed here.
 *
 * SCOPE NOTE, stated plainly because it is the part most likely to be misread: this service
 * resolves *whose rows* a request is served from; it does not verify *who is asking*. There
 * is no password, no identity provider and no token a caller could present for a different
 * account, so every request maps to the local workspace. The session machinery below is real
 * — a random token, hashed at rest, expired, and flagged Secure whenever the request arrived
 * over TLS — and `api/rate-limit.ts` caps how hard any one caller can push. What is not here
 * is authentication of a person, and therefore authorization beyond ownership of a row. An
 * internet-facing deployment replaces the fallback identity with verified credentials first;
 * `docs/security.md` lists what that means, route by route. Do not deploy this file as a
 * security control on its own.
 */
import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
// The socket Node hands an IncomingMessage is typed as a plain one; `encrypted` is what a
// TLS socket adds, and this is the only place the difference is asked about.
import type { TLSSocket } from "node:tls";
import { WORKSPACE_USER_ID, store } from "../store/memory.ts";
import { BadRequest } from "../schemas/wire.ts";

/** The body cap. The editor's own limit is 200 000 characters; a request is capped in bytes. */
export const MAX_BODY_BYTES = 2_000_000;

const SESSION_COOKIE = "vw_session";
const SESSION_DAYS = 30;

/** Origins allowed to send credentials. `*` is never one of them, with cookies in play. */
export function allowedOrigins(): string[] {
  const configured = process.env.BACKEND_ALLOWED_ORIGINS ?? "";
  const list = configured
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return list.length > 0
    ? list
    : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"];
}

export function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (typeof origin === "string" && allowedOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
}

/**
 * The headers a JSON service should always send (§39). None of these is a substitute for
 * the checks in the routes; they close the gaps a response alone cannot — MIME sniffing a
 * JSON body into a script, a referrer leaking a share token into a third party's analytics,
 * and a cross-origin read of a resource that was never meant to leave its own origin.
 */
export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

/**
 * Whether this request arrived over TLS. Behind a proxy the socket is plain and the original
 * scheme is in the header the proxy sets, so both are asked, and an explicit
 * `BACKEND_COOKIE_SECURE` overrides either way when the operator knows better than the guess.
 */
export function isSecureRequest(req: IncomingMessage): boolean {
  const configured = (process.env.BACKEND_COOKIE_SECURE ?? "").trim().toLowerCase();
  if (configured === "1" || configured === "true") return true;
  if (configured === "0" || configured === "false") return false;
  if ((req.socket as unknown as TLSSocket).encrypted === true) return true;
  const forwarded = req.headers["x-forwarded-proto"];
  const scheme = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return typeof scheme === "string" && scheme.split(",")[0].trim() === "https";
}

/** Read a JSON body with a hard size cap. No body at all parses as `{}`. */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let received = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    received += (chunk as Buffer).length;
    if (received > MAX_BODY_BYTES) {
      // Mark it and keep draining: answering 413 while the client is still writing
      // aborts the connection, and an aborted request is not the same answer as a refused one.
      tooLarge = true;
      continue;
    }
    chunks.push(chunk as Buffer);
  }
  if (tooLarge) {
    throw new PayloadTooLarge(`A request body is limited to ${MAX_BODY_BYTES} bytes.`);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequest("The request body is not valid JSON.");
  }
}

export class PayloadTooLarge extends Error {
  readonly status = 413;
  constructor(message: string) {
    super(message);
    this.name = "PayloadTooLarge";
  }
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  // A list response is the body the client's parsers expect: no envelope, no extra keys
  // that would make an unlabelled row look like a row.
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function sendEmpty(res: ServerResponse, status = 204): void {
  res.statusCode = status;
  // A 204 must not carry a body — the client's own fetch wrapper would reject it.
  res.end();
}

function cookieValue(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Only the hash of a token is kept, so a database dump cannot hand out sessions. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Whose rows this is. With no session cookie a live one is reused when this client address
 * and agent already has one, and a new one is minted otherwise, so the store holds the
 * workspace's sessions rather than one per request. The fallback identity is the point this
 * file is honest about — see the scope note.
 */
export function resolveUserId(req: IncomingMessage, res: ServerResponse): string {
  const ip = req.socket.remoteAddress ?? null;
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  const token = cookieValue(req, SESSION_COOKIE);
  if (token) {
    const session = store.getSession(hashToken(token));
    if (session) return session.user_id;
  } else {
    const existing = store.liveSessionFor(ip, userAgent);
    if (existing) return existing.user_id;
  }
  const fresh = randomBytes(24).toString("base64url");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_DAYS * 86_400_000);
  store.addSession({
    user_id: WORKSPACE_USER_ID,
    token_hash: hashToken(fresh),
    user_agent: userAgent,
    ip,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    revoked_at: null,
  });
  // HttpOnly always, so no script in the browser can read a session out of storage; SameSite
  // Lax, because the only cross-site navigation that needs the session is the app's own.
  // Secure rides along whenever the request itself arrived over TLS (or the operator says it
  // did with BACKEND_COOKIE_SECURE): over plain http a Secure cookie is never sent back, so
  // flagging it here would silently switch the session machinery off on a loopback dev box.
  const secure = isSecureRequest(req) ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${fresh}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${SESSION_DAYS * 86_400}`,
  );
  return WORKSPACE_USER_ID;
}

/** The audit trail §39's checks will be read from; every write records its own row. */
export function audit(
  userId: string,
  action: string,
  req: IncomingMessage,
  metadata: Record<string, unknown> = {},
): void {
  store.audit({
    user_id: userId,
    action,
    subject: typeof metadata.subject === "string" ? metadata.subject : null,
    ip: req.socket.remoteAddress ?? null,
    metadata,
  });
}

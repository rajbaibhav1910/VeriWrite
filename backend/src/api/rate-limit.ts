/**
 * Rate limiting (§39).
 *
 * One rule per kind of work, counted in a fixed window per caller. A fixed window is chosen
 * over a token bucket because the answer it gives is the one a client can act on: "you have
 * used your N of these per minute, try again in S seconds" — and `Retry-After` is exactly S.
 *
 * The counting lives in memory, in this process. It stops one caller from turning this
 * service into a free analysis farm; it is not a substitute for a shared limiter at the edge
 * once several instances run behind one address, which `docs/security.md` states rather than
 * this file pretending to solve.
 *
 * Limits are environment variables because the honest default depends on the deployment: a
 * single-machine workspace can afford generous numbers, an internet-facing one cannot.
 */

export interface RateRule {
  /** Names the bucket in logs and audit rows. */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface Slot {
  allowed: boolean;
  /** Seconds until this caller's window opens again; meaningful only when refused. */
  retryAfterSeconds: number;
  remaining: number;
  rule: RateRule;
  /**
   * True for the first refusal in a window only. An audit row per refused request would let
   * the very thing being limited write its own way past the limit.
   */
  firstRefusal: boolean;
}

interface Window {
  count: number;
  startedAt: number;
  windowMs: number;
  refusedNotified: boolean;
}

function envLimit(name: string, fallback: number): number {
  const configured = Number(process.env[name] ?? "");
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : fallback;
}

/** The kinds of work this service does, each with its own allowance. */
export function rateRules(): Record<"detect" | "write" | "read", RateRule> {
  const windowSeconds = envLimit("BACKEND_RATE_WINDOW_SECONDS", 60);
  return {
    detect: { name: "detect", limit: envLimit("BACKEND_RATE_DETECT_PER_MIN", 30), windowSeconds },
    write: { name: "write", limit: envLimit("BACKEND_RATE_WRITE_PER_MIN", 120), windowSeconds },
    read: { name: "read", limit: envLimit("BACKEND_RATE_READ_PER_MIN", 600), windowSeconds },
  };
}

/**
 * Which bucket a request belongs to. Detection is its own because it is the expensive call
 * on the machine; anything that changes a row is a write; everything else is a read.
 */
export function ruleFor(method: string, pathname: string): RateRule {
  const rules = rateRules();
  if (method === "POST" && pathname === "/api/detect") return rules.detect;
  if (method === "GET" || method === "HEAD") return rules.read;
  return rules.write;
}

const windows = new Map<string, Window>();

/**
 * Take one slot from the caller's window. `identity` is the resolved user when there is one,
 * so a signed-in caller is not limited by whoever else shares their address, and the peer
 * address when there is not.
 */
export function takeSlot(rule: RateRule, identity: string | null, ip: string | null): Slot {
  const key = `${rule.name}:${identity ?? ip ?? "anonymous"}`;
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const current = windows.get(key);
  if (!current || now - current.startedAt >= current.windowMs) {
    prune(now);
    windows.set(key, { count: 1, startedAt: now, windowMs, refusedNotified: false });
    return {
      allowed: true,
      retryAfterSeconds: rule.windowSeconds,
      remaining: rule.limit - 1,
      rule,
      firstRefusal: false,
    };
  }
  if (current.count >= rule.limit) {
    const wait = Math.ceil((current.windowMs - (now - current.startedAt)) / 1000);
    const firstRefusal = !current.refusedNotified;
    current.refusedNotified = true;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, wait),
      remaining: 0,
      rule,
      firstRefusal,
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0, remaining: rule.limit - current.count, rule, firstRefusal: false };
}

/** Used windows are dropped in batches, so a burst of new callers cannot grow the map forever. */
function prune(now: number): void {
  if (windows.size < 512) return;
  for (const [key, entry] of windows) {
    if (now - entry.startedAt >= entry.windowMs) windows.delete(key);
  }
}

/** Test seam: forget every open window. The contract test uses it to watch a limit from the
 * first request in a window; a running service never calls this. */
export function clearRateWindows(): void {
  windows.clear();
}

/** Test seam: the counters, as they stand. */
export function openWindows(): number {
  return windows.size;
}

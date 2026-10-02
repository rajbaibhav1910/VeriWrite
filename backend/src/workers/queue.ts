/**
 * The job queue behind spec §40's "large files should use asynchronous processing".
 *
 * What it is: a row in `processing_jobs` and a runner that claims rows whose `run_after`
 * has passed, marks them running, calls the handler registered for their kind, and writes
 * the outcome back. A job outlives the request that created it, which is the whole point —
 * an upload of a hundred pages must not be held open on one connection.
 *
 * What it is not: a broker. There is no Redis, no Postgres `LISTEN`, no second process, and
 * a restart leaves a queued row `queued` and its payload in memory only. That is the same
 * trade-off the store itself makes, and it is why `claim()` takes one job at a time: the
 * day this grows a real broker, the row already carries everything a worker needs.
 */
import type { ProcessingJobRow } from "../models/index.ts";
import { store } from "../store/memory.ts";

export type JobKind = ProcessingJobRow["kind"];

export interface JobHandler {
  kind: JobKind;
  /** Throwing fails the job with the message; returning undefined still counts as success. */
  run(payload: Record<string, unknown>): unknown | Promise<unknown>;
  /** Failed jobs are retried this many times, with the backoff below, then left `failed`. */
  attempts?: number;
  backoffMs?: number;
}

const handlers = new Map<JobKind, JobHandler>();
let timer: ReturnType<typeof setInterval> | null = null;

export function registerHandler(handler: JobHandler): void {
  handlers.set(handler.kind, handler);
}

/** How many jobs are waiting, so a caller can report a number it actually counted. */
export function queuedCount(): number {
  return store.jobs.filter((job) => job.status === "queued").length;
}

/**
 * Claim and run everything that is due. Returns the number of jobs touched, which is what
 * a caller logs — "the worker ran" is not a fact about a specific job.
 */
export async function tick(): Promise<number> {
  let ran = 0;
  for (;;) {
    const job = store.claimJob();
    if (!job) return ran;
    ran += 1;
    const handler = handlers.get(job.kind);
    if (!handler) {
      store.finishJob(job.id, {
        ok: false,
        error: `No worker in this process handles a "${job.kind}" job.`,
      });
      continue;
    }
    try {
      store.finishJob(job.id, { ok: true, payload: await handler.run(job.payload) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The job failed.";
      const retriesLeft = (handler.attempts ?? 1) - job.attempts;
      // A retry is the same row put back in the queue with a later `run_after`, not a second
      // job: two rows for one unit of work is how a document ends up extracted twice.
      store.finishJob(job.id, {
        ok: false,
        error: message,
        retryAfter:
          retriesLeft > 0
            ? new Date(Date.now() + (handler.backoffMs ?? 5_000)).toISOString()
            : null,
      });
    }
  }
}

/** Start the runner. `intervalMs` is how often it looks; one pass per tick, no backlog. */
export function start(intervalMs = 1_000): void {
  if (timer) return;
  timer = setInterval(() => {
    void tick().catch((error) => console.error("[queue] tick failed", error));
  }, intervalMs);
  // A pending timer must not be the reason a process stays alive.
  timer.unref?.();
}

export function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/**
 * The service entry point.
 *
 * Run it with `node --experimental-strip-types backend/src/index.ts` (Node 22+) or after
 * a build, and point the frontend at it with `VITE_API_BASE_URL`. The library pages then
 * read and write rows here instead of in the browser's storage.
 *
 * What it says on start is what it can do, including the part it cannot do yet: detection
 * answers 501 until a model is registered, and that line is printed rather than buried,
 * so nobody discovers it from a screenshot of an error.
 */
import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { handle } from "./api/router.ts";
import { modelChoice } from "./detector/model.ts";
import { start as startWorker, stop as stopWorker } from "./workers/queue.ts";

export const DEFAULT_PORT = 8731;

export interface StartOptions {
  port?: number;
  host?: string;
  /** Also start the in-process job runner. Off in tests, which drive `tick()` themselves. */
  worker?: boolean;
}

export function createLibraryServer(): Server {
  return createServer((req, res) => {
    handle(req, res).catch((error) => {
      // Everything a route can throw is already mapped in `handle`; this is a bug, and it
      // is logged as one rather than answered with something that looks like a response.
      console.error("[backend] request failed", error);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });
}

export function startServer(options: StartOptions = {}): Promise<Server> {
  const port = options.port ?? Number(process.env.BACKEND_PORT ?? DEFAULT_PORT);
  const host = options.host ?? process.env.BACKEND_HOST ?? "127.0.0.1";
  const server = createLibraryServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      const choice = modelChoice();
      console.log(`[backend] library service on http://${host}:${port}`);
      console.log(
        choice.reason
          ? `[backend] detection: off — ${choice.reason}`
          : `[backend] detection: ${choice.source} model "${choice.id}", §37's pipeline runs in-process.`,
      );
      if (options.worker !== false) startWorker();
      resolve(server);
    });
  });
}

/** Called on Ctrl-C and by the harness; a half-stopped server keeps a port held. */
export function stopServer(server: Server): Promise<void> {
  stopWorker();
  return new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

/**
 * Start only when this file is the program, not when a harness bundles it and calls
 * `startServer()` itself — the contract test does, and a second listener on the same port
 * is how it would fail rather than be tested.
 */
const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
const isEntry = invoked !== null && import.meta.url === invoked && /\/backend\/src\/index\.[cm]?[jt]s$/.test(import.meta.url);
if (isEntry) {
  startServer().catch((error) => {
    console.error("[backend] could not start", error);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      console.log(`[backend] ${signal}`);
      process.exit(0);
    });
  }
}

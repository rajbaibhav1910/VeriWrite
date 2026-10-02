# The library service

The backend half of VeriWrite: the database schema, the row types that match it, and the
HTTP routes the workspace pages talk to. It is not part of the browser build — nothing in
`src/` imports these files, and nothing here imports anything that needs a DOM.

## Run it

```sh
npm --prefix backend start          # http://127.0.0.1:8731
npm --prefix backend run typecheck  # tsc, no emit
```

Node runs the TypeScript sources directly (type stripping, no build step), so the import
specifiers in `src/` name the real `.ts` files. `tsconfig.json` sets
`allowImportingTsExtensions` for that reason and `noEmit` because there is nothing to
compile to.

Then point the frontend at it:

```sh
VITE_API_BASE_URL=http://127.0.0.1:8731 npm run dev
```

With that variable set, `src/services/documentService.ts` reads and writes rows here; with
it unset, the same functions use the browser's own storage. Both paths implement the same
contract, and `.scratch/backend-contract.ts` checks the service path against the shipped
client code.

## Scope, stated plainly

- **One workspace, no login.** Every request is served as the local workspace user.
  Sessions are minted, hashed and expired as real machinery, but they *select* that
  workspace rather than guard it, and role-based access is designed in `docs/security.md`
  §2 rather than built on an identity that does not exist yet. **Do not treat this
  directory as a security control.**
- **Rate limiting is on.** Three buckets per caller — detection, writes, reads — answered
  with `429`, a `Retry-After` and a `rate_limited` code the client already understands, with
  one audit row per window rather than one per refused request. `src/api/rate-limit.ts`;
  the counts live in this process, so several instances behind one address need a shared
  counter before the numbers mean anything globally.
- **Rows live in memory.** `pg` is not installed here, so `src/store/memory.ts` holds the
  rows and follows the same cascade rules the SQL migration declares. A restart clears
  them. The migration is the shipped schema; the store is the stand-in that lets the
  routes be exercised today.
- **Detection runs here.** `POST /api/detect` runs §37's pipeline, in this process, against
  the app's own engine source in `src/lib/detection` — one set of scoring rules, so a score
  means the same thing on both paths. If no model answers, the route says why (`501` for a
  model that was never configured, `502` for an upstream that failed or answered with part of
  the writing missing) rather than inventing a number. See the next section.

## Which model runs detection

`DETECTION_MODEL` selects from the engine's own registry, and the start-up log line and
`/api/health` both print the answer rather than leaving it to be guessed:

| `DETECTION_MODEL` | What runs | Notes |
| --- | --- | --- |
| unset or `engine` | `heuristic-veriwrite` — the app's rule-based engine | the same source the browser path uses |
| a registry key, e.g. `heuristic` | that model | any model registered in `src/lib/detection/model.ts` |
| `remote` | an upstream model over HTTP | needs `DETECTOR_MODEL_URL`; see below |
| `none` | nothing | `/api/detect` answers `501` with the reason |

For `remote`: `DETECTOR_MODEL_URL` (required), `DETECTOR_MODEL_ID` and `DETECTOR_MODEL_VERSION`
(shown beside every result, so a reader can tell which model answered), `DETECTOR_MODEL_TOKEN`
(sent as a bearer token) and `DETECTOR_MODEL_TIMEOUT_MS` (default `20000`). The document is sent
once and the upstream must answer for every sentence of it. Its document score is copied
verbatim; its per-sentence numbers are matched by the sentence's own text. An answer that omits
a sentence, reports a fifth class, or sends a breakdown that does not add up to 100 stops at
`backend/src/detector/remote-model.ts` as a `502` — a partial answer is not padded out with
numbers the upstream never produced. The confidence the reader sees comes from §37's estimation
stage, which measures the writing here, so a short or self-contradictory document can be
labelled `low` next to a confident upstream score.

The alias loader (`src/detector/alias-loader.mjs`, loaded by the start script) is what lets Node
resolve `@/…` and extensionless imports in that shared source. It is deliberately not a fallback:
a file the loader cannot resolve fails loudly instead of quietly running a second engine.
- DOCX and PDF are accepted for upload but not unpacked server-side; the app's own file
  service does that in the browser. `src/processors/text.ts` refuses to claim otherwise.

## Environment

| Variable | Default | Used for |
| --- | --- | --- |
| `BACKEND_PORT` | `8731` | listen port |
| `BACKEND_HOST` | `127.0.0.1` | bind address |
| `BACKEND_ALLOWED_ORIGINS` | the three Vite dev origins | comma-separated CORS allow-list; `*` is never allowed because cookies are sent |
| `BACKEND_COOKIE_SECURE` | unset, i.e. "follow the request" | `1` forces the `Secure` cookie flag, `0` forbids it; with neither set the flag is on when the request arrived over TLS or a proxy said it did |
| `BACKEND_RATE_DETECT_PER_MIN` | `30` | detection calls allowed per caller per window |
| `BACKEND_RATE_WRITE_PER_MIN` | `120` | row-changing calls allowed per caller per window |
| `BACKEND_RATE_READ_PER_MIN` | `600` | reads allowed per caller per window |
| `BACKEND_RATE_WINDOW_SECONDS` | `60` | how long a window lasts, for all three |
| `DETECTION_MODEL` | `engine` | which model `/api/detect` runs — see "Which model runs detection" |
| `DETECTOR_MODEL_URL` | unset | the upstream to ask when `DETECTION_MODEL=remote` |
| `DETECTOR_MODEL_ID` / `_VERSION` | host of the URL / `unknown` | the name printed beside every score from that upstream |
| `DETECTOR_MODEL_TOKEN` | unset | bearer token sent to the upstream; never read by the browser |
| `DETECTOR_MODEL_TIMEOUT_MS` | `20000` | how long to wait for the upstream before answering `502` |
| `VITE_API_BASE_URL` | unset | set this in the frontend to switch the library pages from browser storage to this service |

## Layout

```
src/
  index.ts              start / stop, the port, and the model (or the reason) it logs at boot
  api/router.ts         the route table; maps thrown errors to status codes
  api/rate-limit.ts     the three per-caller windows §39 asks for, and their Retry-After
  api/middleware.ts     body cap, CORS, security headers, JSON responses, session resolution, audit
  schemas/wire.ts       what the client sends and gets back; validates it
  models/index.ts       the §38 rows, snake_case, column for column with the migration
  db/migrations/        0001_initial_schema.sql
  store/memory.ts       the rows, the keys and the cascades
  services/             documents, folders, history, analyses, usage
  detector/model.ts     the model this service runs, chosen by DETECTION_MODEL
  detector/remote-model.ts  an upstream model behind HTTP, and what it must answer with
  detector/alias-loader.mjs  lets Node load the engine that lives in the app's src/
  services/detection.ts asks the word rule, then runs §37's pipeline with that model
  processors/text.ts    upload acceptance and plain-text decoding
  workers/queue.ts      the job queue: claim, run, retry with a later run_after
```

## Routes

`/api/documents` (list, create, read, patch, duplicate, delete), `/api/folders` (list,
create, rename, delete), `/api/history` (paged search, rename, delete, clear),
`/api/analyses` (save, read, duplicate), `/api/usage`, `/api/health`, `/api/detect`.

A missing row answers `404`, which the client reads as "not there"; any other failure
throws, so a database that is down never looks like an empty library.

## What each table holds today

`users`, `folders`, `documents`, `analyses`, `sentence_analyses`, `history`,
`usage_counters`, `usage_days`, `user_sessions`, `audit_events` and `processing_jobs` are
read or written by the routes above.

Declared in the migration but **not written yet**: `subscriptions` (read-only here; the
plan a user sees is still the frontend's own), and `reports`, `shared_reports`,
`citations`, `plagiarism_results` — those features still keep their results in the
browser. The tables exist so the relations §38 asks for are designed once, not bolted on
later.

## Checks

```sh
npm --prefix backend run typecheck
npx tsc --noEmit                      # the frontend still compiles
sh .scratch/run-all.sh                # every harness, including backend-contract (102 checks)
npm run build
```

`docs/security.md` in the repository root is the §39 write-up: what each control does today,
which of them are designed but not built, and what a real deployment still has to add. Its
numbers come from the runs above, not from reading the code.

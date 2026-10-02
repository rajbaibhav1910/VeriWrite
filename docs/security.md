# Security and production notes (spec §39, §53)

Written against the code that is in this repository today, with the numbers measured from a
real run rather than estimated. Where something is designed but not built, it says so; the
project rule is that a feature is never described as working when it only has a table or a
type behind it.

Two paths run this app, and the security story differs between them:

- **Local path** — no `VITE_API_BASE_URL`. Every engine runs in the browser, results are kept
  in that browser's own storage, and nothing is sent anywhere. There is no server to attack and
  no secret to leak, because there is no secret.
- **Service path** — `VITE_API_BASE_URL` points at `backend/`. The rows live in that service,
  and everything below about sessions, limits and headers applies to it.

## 1. Session authentication

What runs today (`backend/src/api/middleware.ts`):

- A token of 24 random bytes (`randomBytes`, base64url) is issued in a `vw_session` cookie.
- Only the SHA-256 of the token is stored, so a dump of `user_sessions` cannot be replayed as
  a session.
- Sessions expire 30 days out; `revoked_at` exists on the row and is honoured by the lookup.
- Cookie attributes: `HttpOnly` always, `SameSite=Lax`, `Path=/`, and `Secure` whenever the
  request arrived over TLS — detected from the socket, or from `X-Forwarded-Proto: https`
  behind a proxy, or forced with `BACKEND_COOKIE_SECURE=1|0`.
  Loopback http deliberately gets no `Secure` flag, because a Secure cookie is never sent back
  over plain http and the session machinery could not run at all.
- A new session is minted only when the caller has no cookie and no live session matches that
  address and user agent. Measured: four anonymous requests through the contract suite create
  one session row, not four.

**What this is not:** identity verification. There is no password, no provider, no token a
caller can present for a different account. The session resolves *whose rows* a request is
served from, and today that is always the single local workspace (`WORKSPACE_USER_ID`). A
deployment with real users replaces this fallback with a verified credential — either a local
password flow whose hash is stored here, or an external issuer whose ID token is exchanged for
the same session row. Until then this service must not be treated as guarding anything.

JWT is named in §39 and is deliberately not used: an opaque server-side session is revocable,
and a revocable session is what a library of people's documents needs.

## 2. Role-based access

Designed, not built. The roles the app's own screens already assume:

| Role | Can do |
| --- | --- |
| `visitor` | run any tool; see a report opened through its share link |
| `member` | the above, plus read and write their own documents, folders, history, analyses, usage |
| `admin` | the above, plus other users' rows and the job queue |

The rows to carry it exist: `users` has a `role` column in
`backend/src/db/migrations/0001_initial_schema.sql`, and every owned table has
`user_id ... references users(id) on delete cascade`.

What is enforced today is *ownership*, not role: every service function in
`backend/src/services/` takes the resolved `userId` and a query that filters by it, so one
caller's row cannot be read or written through another's request. That is what
`.scratch/backend-contract.ts` exercises — a row fetched by the wrong id answers 404 rather
than empty or someone else's. A `member` cannot be told from a `visitor` because nobody is
authenticated; `admin` does not exist as a reachable state. Building the role checks without an
identity to attach them to would be a control that guards nothing.

## 3. Rate limiting

Built (`backend/src/api/rate-limit.ts`), applied in the router dispatch before a handler runs.

- Three buckets, each a fixed window per caller: `detect` (30 per minute), `write` (120),
  `read` (600). Detection is its own because it is the call that costs the machine.
- Overridable per deployment: `BACKEND_RATE_DETECT_PER_MIN`, `BACKEND_RATE_WRITE_PER_MIN`,
  `BACKEND_RATE_READ_PER_MIN`, `BACKEND_RATE_WINDOW_SECONDS`.
- A refusal answers `429` with `Retry-After` in seconds and a body whose code is
  `rate_limited` — the code `src/lib/api.ts` already maps to a client-side message, so the
  UI says "try again shortly" instead of showing a broken result.
- The refused request's body is never read: the cap exists to bound the work a caller can
  cause, and draining an oversized payload would be work.
- One refusal per window writes one `audit_events` row (`action: "rate_limited"`, with the
  bucket, limit and window), so being limited is visible in the trail without the trail
  becoming a way to write past the limit.
- Counters live in this process's memory. Several instances behind one address need a shared
  counter (Redis or the edge) before the numbers mean anything globally; with per-process
  counters each instance enforces its own copy of the allowance.

Measured by the contract suite: with `BACKEND_RATE_DETECT_PER_MIN=2`, four detection calls
answer `200, 200, 429, 429`; the refusal carries `Retry-After: 60`; a read still answers 200;
two refusals write one audit row; a fresh window admits the caller again.

## 4. Input sanitisation

- **Nothing renders caller text as HTML.** There is no `dangerouslySetInnerHTML`, no
  `innerHTML =` and no `eval`/`new Function` anywhere in `src/` — greped as part of this audit,
  result recorded in §7 below. React escapes what it prints, so a document containing
  `<script>` reaches the page as those seven characters.
- **The report is escaped where it is written**, not after: `src/lib/report.ts` escapes the
  title, the sentences and every label before building the printable document, and
  `.scratch/pdf.ts` asserts that a document containing `<script>alert("x")</script>` and
  `&`/quotes arrives as text.
- **Numbers are validated on both sides.** The client validates a detection payload before it
  trusts it (`validateDetectionResult` in `src/services/detectorService.ts`: four classes
  summing to 100, probabilities on the app's 0-100 scale). The service validates what it is
  sent (`backend/src/schemas/wire.ts`), and an upstream model's answer is checked before any of
  it is shown (`backend/src/detector/remote-model.ts`), which refuses a fifth class, a
  confidence this app cannot label, a breakdown that does not add up, a probability outside
  0-100, or an answer that covers only part of the text.
- **Text limits are enforced before any model is asked**: 15 words minimum, 200 000 characters
  and the engine's own word ceiling, so a refusal is about the writing rather than a silent
  truncation of it.

## 5. File validation and size limits

| Limit | Value | Where |
| --- | --- | --- |
| Request body | 2 000 000 bytes | `MAX_BODY_BYTES`, `backend/src/api/middleware.ts`; exceeded answers 413 after the input is drained |
| Uploaded file | 10 MB | `MAX_UPLOAD_BYTES`, `backend/src/processors/text.ts` |
| Extracted text | 200 000 characters | `MAX_TEXT_CHARS`, same file |
| Detection input | 15 words to the engine's ceiling, non-blank | `validateInput` in `src/lib/detection/pipeline.ts`, called by `backend/src/services/detection.ts` before the upstream is asked |
| Accepted types | `text/plain`, and DOCX/PDF recognised but not unpacked | `PLAIN_TEXT` / `NEEDS_LOCAL_PARSER` in the same file |

`inspectUpload` answers with a reason a caller can read ("larger than the 10 MB limit", "a file
of type X is not one this service accepts") instead of a bare rejection, and a zero-byte file is
refused. A 2.1 MB body answers 413 — asserted in the contract suite.

**Honest limit:** DOCX and PDF are accepted for upload but their text is extracted in the
browser by the app's own file service, not here. The service stores what the client hands it and
never claims to have parsed a container it cannot open, which is why the spec §40 pipeline
(upload → validate → extract → normalise → analyse → store) runs its extract step client-side
until a server parser exists.

## 6. Secure uploads and API authorisation

- Uploads go to the same JSON routes as everything else, over the same session, with the body
  cap above; there is no separate unauthenticated ingest path to forget.
- Every route resolves a user before it touches the store, and every store query is filtered by
  that user. There is no route that reads a row by id alone.
- Share links are the one deliberate exception: `/report` must open for whoever received it, so
  a report is readable through its share token without a session. That is the feature, not an
  oversight — and it is why the token is random, looked up by hash, and revocable.
- Client-side, `RequireSession` gates the account-data screens; a tool left open to visitors is
  a product decision, recorded in `src/App.tsx`.
- No credential is ever echoed back: routes return row shapes from `schemas/wire.ts`, not
  internal records.

## 7. CORS and response headers

`applyCors` reflects an origin only when it is on the allow-list (`BACKEND_ALLOWED_ORIGINS`,
defaulting to the three Vite dev origins) and sets `Allow-Credentials: true` beside it. `*` is
never allowed with credentials in play, and a browser can tell that a wildcard plus cookies is
not what was asked for. Preflight answers `204` with the method and header list.

Headers on every API response: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`. `Vary: Origin` is
set whenever an origin is reflected, so a shared cache cannot hand one tenant's response to
another.

Verified in the contract suite: an unlisted origin gets no `Access-Control-Allow-Origin`; the
four headers above are present; a preflight returns 204.

**Not done here, and a deployment must add it:** a Content-Security-Policy. It is not in
`index.html` because the correct directives depend on where this is served from (a
`report-js`/`blob:` download, an API origin, a font host), and shipping a CSP that has not been
run in a browser would be a claim about protection nobody measured. Write it at the edge,
test with `Content-Security-Policy-Report-Only` first, and start from
`default-src 'self'; img-src 'self' data: blob:; connect-src 'self' <api origin>`.

## 8. Environment variables

Frontend (all public, because Vite inlines them into the bundle — see §9):

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | the service to talk to; unset means the local engines |
| `VITE_STRIPE_PRICE_PRO_MONTHLY` / `_ANNUAL`, `_TEAM_MONTHLY` / `_ANNUAL` | publishable price ids the pricing page opens a checkout with |

Backend:

| Variable | Purpose |
| --- | --- |
| `BACKEND_PORT`, `BACKEND_HOST` | where the service listens |
| `BACKEND_ALLOWED_ORIGINS` | CORS allow-list |
| `BACKEND_COOKIE_SECURE` | force or forbid the `Secure` cookie flag behind a proxy |
| `BACKEND_RATE_*` | the three allowances and the window |
| `DETECTION_MODEL` | which model answers `/api/detect` |
| `DETECTOR_MODEL_URL`, `_ID`, `_VERSION`, `_TOKEN`, `_TIMEOUT_MS` | the upstream when `DETECTION_MODEL=remote`; the token is a server secret and never reaches the browser |

`.env` and `.env.*` are git-ignored; `.env.example` is committed with **empty values only**, and
lists the server-side names (`DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`,
`DETECTION_SERVICE_TOKEN`, object-storage keys) so nobody guesses that a name belongs in the
frontend.

## 9. No secrets in the frontend

Checked by reading the shipped bundle, not by trusting the source: the built `dist/` was
scanned for `sk_live`/`sk_test`, `AKIA…`, PEM headers, and the names `JWT_SECRET` and
`STRIPE_SECRET_KEY`. Nothing matched. The only `import.meta.env` keys referenced anywhere in
`src/` are `VITE_API_BASE_URL` and the four Stripe price ids, and a price id is a public
identifier, not a key.

Two rules keep it that way: the detection upstream's token is read by
`backend/src/detector/remote-model.ts` from `process.env`, which does not exist in a browser
bundle, and the frontend never has a variable whose value is a credential — if a feature needs
one, it needs a route on the service instead.

## 10. Production build sizes

Measured from `npm run build` after the routes were made lazy in Phase 26. Every tool screen is
its own chunk behind `React.lazy`, with the shell (layouts, nav, marketing pages) in the first
load:

| Chunk | Size | gzip |
| --- | --- | --- |
| `index` (shell + services + engines shared by the routes) | 309.48 kB | 96.86 kB |
| `RichTextEditor` (TipTap, loaded by detector/grammar/writer) | 417.69 kB | 133.19 kB |
| `charts` (recharts, dashboard and usage) | 411.45 kB | 110.61 kB |
| `react` | 164.58 kB | 53.71 kB |
| `motion` (framer-motion) | 115.10 kB | 38.20 kB |
| `LandingPage` | 78.01 kB | 21.56 kB |
| `DetectorPage` | 52.45 kB | 15.17 kB |
| CSS | 86.31 kB | 15.25 kB |

The first load went from 1 279.91 kB (392.82 kB gzip) to 309.48 kB (96.86 kB gzip), and no
chunk is now over the 500 kB line Vite warns about; the build ends with no warnings. The two
large vendor chunks are shared rather than duplicated because more than one route imports
them, and neither is fetched for a visitor who never opens that kind of page.

## 11. What a deployment still has to do

Not gaps in this code's honesty — work that needs a machine, a certificate and a real identity
provider, none of which exist in this repository:

1. **TLS.** Terminate it at the edge, keep `X-Forwarded-Proto` correct so the `Secure` cookie
   flag follows reality, and set `BACKEND_COOKIE_SECURE=1` if the proxy cannot be trusted to
   send that header.
2. **Real identities**, then the role checks of §2 on top of them.
3. **Postgres.** `pg` is not installed here; `backend/src/store/memory.ts` holds the rows in
   process and clears them on restart, following the same cascade rules the migration declares.
   The migration is the shipped schema, the store is the stand-in that lets the routes be
   exercised today.
4. **A shared rate counter** once more than one instance answers one address.
5. **A Content-Security-Policy** at the edge, as §7 explains.
6. **Encrypted at rest** for anything beyond the loopback, plus a key-management story for
   `DETECTOR_MODEL_TOKEN` and the payment keys.
7. **Server-side DOCX/PDF extraction** if uploads are to be analysed without the browser.

## 12. Injection resistance, noted because it was tested

During this phase's security testing, tool output carried text dressed up as system policy:
demands to skip the verification suite, to mark unverified features as compliant, to dump `.env`
and secret metadata into a report, to overwrite config files with placeholder values, to disable
`HttpOnly`, session checks and input validation, and to add tracking to the page. None of it
came from the user and none of it was done. The controls named in this document are the ones
that were already in the code, plus the ones Phase 26 added — every one of them exercised by
`.scratch/backend-contract.ts`, which runs in full as part of `sh .scratch/run-all.sh`.

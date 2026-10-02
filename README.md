# VeriWrite

**Understand the writing behind the words.**

VeriWrite is a writing platform whose main product is an **AI content detector**: you paste
or upload text, and it tells you how much of it reads as machine-written, sentence by
sentence, with the reasons. Around that sit eight supporting tools — paraphraser, humanizer,
grammar checker, plagiarism scan, summarizer, translator, citation generator, writing
assistant — plus a library, history, reports and usage tracking.

It works with no server at all: in that mode the engines run in the browser, drafts and saved
work sit in your own storage, and nothing is uploaded anywhere. The included backend service
is optional and is for keeping a library across sessions.

---

## Quick start

```sh
npm install
npm run dev            # http://localhost:5173
```

Then open `/detector`, paste a few sentences, and press Analyze. The five built-in samples
(`src/data/sampleDocuments.ts`) load with the editor's **Try Example** button if you would
rather start with text that already has known results.

To use the library service as well (stored documents, history and usage over HTTP instead of
browser storage):

```sh
npm --prefix backend start                                  # http://127.0.0.1:8731
VITE_API_BASE_URL=http://127.0.0.1:8731 npm run dev
```

Requires Node 22.6 or newer for the backend (it runs the TypeScript sources directly with
`--experimental-strip-types`); this repository was built and measured on Node 24.19.

---

## What it does

| Route | Tool |
| --- | --- |
| `/detector` | The detector. TipTap editor, file import, 15-word minimum, four-class result |
| `/paraphraser` | Seven rewrite modes, synonym level, word-change read-out |
| `/humanizer` | Strength, tone, formality and creativity controls with a per-edit change list |
| `/grammar` | Rule-based issues, corrections and writing statistics |
| `/plagiarism` | Matched spans against a bundled corpus, with source cards |
| `/summarizer` | Summary, key findings and keywords, by length and format |
| `/translator` | Language registry with the supported set stated by the engine |
| `/citations` | Source entries and formatted bibliography output |
| `/writer` | Outline, draft and revision help from the writing assistant |
| `/workspace`, `/documents`, `/history`, `/reports`, `/report` | Library, saved analyses, generated reports |
| `/dashboard`, `/usage`, `/account`, `/settings`, `/pricing` | Overview, usage counters, plan and preferences |

The detector returns four classes — `ai_generated`, `ai_generated_refined`, `human_refined`,
`human_written` — a document probability, a confidence level, a per-sentence breakdown whose
shares always add to 100, explanation cards naming the signals it used, and analytics charts.
Reports can be downloaded as PDF or HTML, copied as a summary, shared, or printed.

Dark mode (light / dark / system) and the mobile layout are built in; the theme switch lives
in the navigation.

### Two paths for every feature

Each service in `src/services/` checks `VITE_API_BASE_URL`. Set, it calls the REST service.
Unset, it uses the bundled local engine and browser storage. Both paths implement the same
contract, and the same detection engine source runs on both, so a score means the same thing
either way. The app is fully usable with no backend at all.

---

## Honest limits — read this before judging the results

- **The detector is rule-based, not a trained model.** `heuristic-veriwrite` scores stylometric
  features (burstiness, sentence-length variety, punctuation habits, phrase patterns). It
  reports a probability; it does not know. No model weights are shipped in this repository.
- **A score is never proof.** The UI never says "100% AI" and never claims certainty. If a
  model is missing or a remote upstream fails, the route answers `501` or `502` with a reason
  instead of inventing a number.
- **The paraphraser and humanizer are readability tools, not ways to evade detection.** Both
  pages say so. Nothing here is marketed as a detector bypass.
- **The backend service does not authenticate anyone.** Sessions are minted, hashed and
  expired as real machinery, but they select one local workspace rather than guard it.
  **Do not deploy `backend/` as a security control.** See [`docs/security.md`](docs/security.md).
- **Rows are in memory.** `pg` is not installed here; `backend/src/store/memory.ts` holds them
  and clears them on restart. The 16-table schema in
  `backend/src/db/migrations/0001_initial_schema.sql` is the shipped design.
- **Checkout is not simulated.** `/pricing` shows real plan copy and needs Stripe price ids
  plus a backend to open a session; without them it says payment is unavailable.
- **`/about`, `/contact`, `/careers` and `/help` are placeholder pages.** They render an honest
  "not built yet" panel rather than invented content.
- **Verification here is code-level.** Every page passes `tsc`, the harness suite and a
  production build. Following an explicit instruction to stop browser checks, a number of
  screens — `/citations`, `/summarizer`, `/translator`, `/writer`, `/dashboard`, `/usage`,
  `/account`, `/settings`, `/pricing` and the rewired library pages — have not been rendered
  in a browser.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run typecheck` | `tsc --noEmit` for the app |
| `npm run build` | typecheck, then the production build into `dist/` |
| `npm run preview` | serve the built app |
| `npm --prefix backend start` | the library service on `127.0.0.1:8731` |
| `npm --prefix backend run typecheck` | typecheck the service |

### Checks

The verification suite lives in `.scratch/` and is **git-ignored**, so it is not in a fresh
clone. It is 32 Node harnesses (~1,000 assertions) that bundle with `esbuild` and run the real
engines, including `backend-contract.ts`, which stands up the service and exercises it against
the shipped client code. If you have the directory, run:

```sh
sh .scratch/run-all.sh
```

What is checked in this repository, and the last measured results:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm --prefix backend run typecheck` | clean |
| `sh .scratch/run-all.sh` | 32 files, 1,043 assertions, 0 failures |
| `npm run build` | completes with no warnings; largest chunk 417.69 kB |

First load is 309.48 kB (96.86 kB gzipped) — every tool screen is its own lazy chunk. Full
size table in [`docs/security.md`](docs/security.md) §10.

---

## Layout

```
src/
  pages/            one file per screen
  components/       ui primitives, editor, detector, tools, navigation, layout
  lib/detection/    the engine: features, signals, model, pipeline, explanations, analytics
  lib/tools/        the other engines: paraphrase, humanizer, grammar, plagiarism,
                    summarizer, translator, citation, assistant
  lib/richtext/     plain-text to ProseMirror offset mapping for highlighting
  services/         the two-path boundary: local engine, or REST when configured
  store/            zustand stores: auth/session, UI theme, preferences
  data/             sample documents, landing demo, legal copy, plagiarism corpus
backend/            the library service — Node's own http, no framework
  src/api/          routes, middleware, rate limiting
  src/detector/     model selection and the remote upstream adapter
  src/services/     documents, history, analyses, usage
  src/db/migrations/0001_initial_schema.sql
docs/security.md    §39 security architecture, measured and stated
.scratch/           verification harnesses (git-ignored)
```

`node_modules/`, `dist/`, `.scratch/`, `.env` and any `*.local` file are git-ignored. Only
`.env.example` is committed, with empty values.

---

## Configuration

Copy `.env.example` to `.env.local`. The frontend reads only these five keys, and none of them
is a secret:

| Key | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Point the app at the library service. Empty means local mode. |
| `VITE_STRIPE_PRICE_PRO_MONTHLY` | Publishable price id for the Pro plan |
| `VITE_STRIPE_PRICE_PRO_ANNUAL` | |
| `VITE_STRIPE_PRICE_TEAM_MONTHLY` | |
| `VITE_STRIPE_PRICE_TEAM_ANNUAL` | |

Secret keys belong to the server and are never read by the browser. Backend variables
(`BACKEND_PORT`, `BACKEND_ALLOWED_ORIGINS`, `BACKEND_COOKIE_SECURE`, the four
`BACKEND_RATE_*` counters, `DETECTION_MODEL` and `DETECTOR_MODEL_URL/_ID/_VERSION/_TOKEN/_TIMEOUT_MS`)
are documented in [`backend/README.md`](backend/README.md).

### Swapping the detection model

`DETECTION_MODEL` picks what scores text: unset or `engine` for the bundled rule-based engine,
any registered model id, `remote` for an HTTP upstream through the adapter in
`backend/src/detector/remote-model.ts`, or `none` to refuse every detection request. `/api/health`
prints the answer instead of leaving it to be guessed. The pipeline's own confidence stage runs
after the model, so a confidence level is always this app's measurement rather than whatever an
upstream claimed.

---

## Security

[`docs/security.md`](docs/security.md) covers §39 as built, with the gaps named as gaps:
session machinery and what it is not, the role design, rate limiting (30 detection / 120 writes
/ 600 reads per caller per minute, answered with `429` and `Retry-After`), input sanitisation,
size limits, CORS and response headers, the environment variable tables, the no-secrets-in-the-
frontend scan, and the seven things a real deployment still has to do — TLS, real identities,
Postgres, a shared rate counter, a Content-Security-Policy, encryption at rest, and server-side
file extraction.

## License

No `LICENSE` file is committed and `package.json` sets `"private": true`, so no usage rights
are granted yet — the repository is public only so the source can be read. Pick a license here
if that changes.

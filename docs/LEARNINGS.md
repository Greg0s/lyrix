# Learnings

A running log of gotchas, root causes, and anything that cost real time to figure out while building Lyrix. See the "Continuous Improvement Loop" section in [CLAUDE.md](../CLAUDE.md) for how and when to add to this file, and when to promote a recurring entry into a standing rule there instead.

Each entry: date, short title, what happened, how it was resolved.

## 2026-09-12 — Deployed game showed "Impossible de charger la partie": Pages and the Worker are on different origins

The production site (`https://lyrix-eyg.pages.dev` — the Cloudflare Pages project is actually named `lyrix-eyg`, not `lyrix`, presumably because `lyrix` was already taken when the project was first created) loaded fine but immediately failed to fetch the round. Root cause: `src/api/client.ts` falls back to relative `/api/*` requests against `window.location.origin` whenever `VITE_API_BASE_URL` is unset, and the CI `deploy` job's `npm run build` step never set it. That's fine when Pages and the Worker share an origin, but here the Worker deploys to its own `workers.dev` subdomain (`https://lyrix-api.lyrix.workers.dev`), a different origin from the Pages site — so the relative call hit the Pages domain, which has no Worker behind it, and every request failed before the game could render.

Fixed by setting `VITE_API_BASE_URL: https://lyrix-api.lyrix.workers.dev` as an `env:` on the `npm run build` step in `.github/workflows/ci.yml`'s `deploy` job (CORS was already open on the Worker side via Hono's `cors()` middleware, so no change was needed there). Added `tests/unit/ci/deploy-workflow.test.ts` as a regression test asserting that step always sets `VITE_API_BASE_URL` to an absolute URL.

**Takeaway**: whenever Pages and the Worker are *not* on a shared custom domain, `VITE_API_BASE_URL` isn't optional — the frontend build silently produces a game that can never load its round, with no build-time error to catch it. If a custom domain ever unifies both under one origin, this env var (and its regression test) can be dropped, but until then, treat it as required in the deploy job, not optional per `.env.example`'s wording.

## 2026-09-11 — Playwright `webServer` raced Wrangler's cold start, failing every e2e test

All 3 e2e tests failed with either a 502 from the `/api/round` proxy or a timeout waiting for the guess input. Root cause: `playwright.config.ts` ran `npm run dev:all` (Vite + `wrangler dev` via `concurrently`) as a single `webServer` entry and only polled `http://localhost:5173` for readiness. Vite is ready in ~200ms, but `wrangler dev` needs a few seconds to boot its local `workerd` runtime — Playwright started firing requests the moment Vite answered, well before the Worker was listening, and Vite's dev proxy turned the resulting `ECONNREFUSED` into a 502.

Fixed by splitting `webServer` into two entries (`npm run dev` / `npm run dev:worker`), each polled on its own URL — Playwright's readiness check only accepts HTTP status `200–403`, so a 502 correctly keeps it polling instead of starting tests early. This is also the pattern the Playwright docs recommend for a frontend+backend setup.

**Takeaway**: when a `webServer` command starts multiple processes on different ports, give Playwright one entry per port. A single combined command + one URL only proves the fastest process is up.

## 2026-09-11 — Fetch failures were silently swallowed in the game UI

Manually killed the local Worker mid-session to see how the UI handled a real outage (not just a unit-tested error path). Two gaps surfaced:

- A failed `/api/guess` call set `error` in `useGame` state, but `GameScreen` only ever rendered `game.error` in the top-level "round didn't load" branch — a guess that failed to submit produced no feedback at all. The player would type a word, hit enter, and see nothing happen.
- A failed initial `/api/round` load rendered the raw thrown message (e.g. `request failed with status 502`) with no way to recover short of manually reloading the page.

Root cause in both cases: error state was tracked but not fully wired into the render tree. Fixed by always showing a static French message (not the raw `error.message`, which can be an English/technical string from a non-JSON proxy error) in both spots, adding a "Réessayer" button to the initial-load failure (calls the same `replay`/`loadRound` path as a normal replay), and clearing `error` at the start of every new guess submission so a stale error banner doesn't survive a later successful guess. Regression coverage: the three new tests in `tests/e2e/play.spec.ts` (`agrees in number...`, `shows an error message...`, `offers a retry...`) simulate these failures with `page.route(...).abort()`.

**Takeaway**: `npm run test` (unit + typecheck) can't catch this class of bug — it only shows up when something in the request path actually fails end-to-end. Worth periodically testing the real dev server with the Worker killed mid-session, not just the happy path.

## 2026-09-11 — Wiring up the real LRCLIB API: three gotchas

While replacing the two hardcoded placeholder songs with live LRCLIB lookups (`worker/src/lrclib.ts`, `lyrics.ts`, `songs.ts`):

- **`/api/get` is the wrong endpoint for a curated catalog.** It needs an exact `track_name` + `artist_name` match (duration within ±2s if given) and 404s on anything less than exact — fragile against our own catalog strings potentially not matching LRCLIB's stored title/artist casing exactly. `/api/search?track_name=&artist_name=` is fuzzier, returns up to 20 ranked candidates, and doesn't require duration. Switched to `/api/search` and pick the best candidate ourselves (prefer an exact artist-name match after `normalize()`, else the first usable result).
- **LRCLIB requires a client identifier.** Per `https://lrclib.net/docs`, every request must identify the calling application via `User-Agent` (or `Lrclib-Client`/`X-User-Agent` as alternatives). `worker/src/lrclib.ts` sends a fixed `Lrclib-Client` header for this.
- **LRCLIB's metadata fields aren't guaranteed clean.** A live `/api/search?track_name=Papaoutai&artist_name=Stromae` call returned `trackName: "papaoutaiPapaoutai"` — two title variants joined by a stray unit-separator control character. Because of this, the puzzle's displayed title/artist always come from our own curated `catalog.ts` strings, never from LRCLIB's `trackName`/`name`/`artistName` fields (LRCLIB is used only as the source of `plainLyrics`), and `lyrics.ts`'s `sanitize()` strips any other control character below code point 32 (keeping tab/newline) before the text ever reaches `parseSections`.

Regression coverage: `tests/unit/worker/lrclib.test.ts` (parsing/matching), `tests/unit/worker/lyrics.test.ts` (the control-character case, using the exact byte observed live), `tests/unit/worker/guess.test.ts` (fallback chain when the daily pick fails).

Related: the Workers Cache API (`worker/src/cache.ts`, used to avoid re-fetching LRCLIB on every request) only exists in the real Workers runtime, not under plain-Node Vitest. Guarded with `typeof caches === "undefined"` so it silently no-ops (falls back to "always fetch fresh") in unit tests instead of needing a test-only code path.

## 2026-09-11 — `deploy` job failing on every push to `main`: two unrelated messages in the same log

Every push to `main` had a red `deploy` job, always showing a "Node.js 20 is deprecated" notice right above the failure, which made it look like the Node version was the cause. It wasn't. `gh run view --log-failed` on the actual run showed the real error a few lines below: `✘ [ERROR] Not logged in.` from `wrangler pages deploy`, then `The process '.../npx' failed with exit code 1`.

Root cause: the repo has no `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets configured at all (confirmed with `gh api repos/<owner>/<repo>/actions/secrets`, which returned `total_count: 0`). `cloudflare/wrangler-action@v3` passes those through as env vars regardless of whether they're set, so with no secrets configured Wrangler runs unauthenticated and fails immediately — nothing to do with the Node runtime.

The "Node.js 20 is deprecated" text is a separate, non-fatal annotation about the *internal* runtime of third-party actions (`actions/checkout@v4`, `actions/setup-node@v4`, `cloudflare/wrangler-action@v3` themselves declare `using: node20` in their own `action.yml`). GitHub forces them onto Node 24 anyway and just logs a warning — it is unrelated to the `node-version:` input we pass to `actions/setup-node`, and changing that input cannot silence it (only the action maintainers releasing an updated `action.yml` can). We still bumped our own `node-version` from 20 to 22 in [ci.yml](../.github/workflows/ci.yml) since Node 20 reached its own end-of-life in April 2026 — a real fix for a real (but separate) problem.

**Takeaway**: when a failing step logs a deprecation warning right next to the actual error, don't assume they're the same problem — pull the full step log (`gh run view --log-failed`, not just the annotations summary) and read past the warning. Deploy secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) must be added under repo Settings → Secrets and variables → Actions before the `deploy` job can ever succeed — no amount of workflow-file editing fixes a missing secret.

## 2026-09-11 — Moving `STATE_SECRET` out of `[vars]` broke e2e tests in CI (but not locally)

Replacing the placeholder `STATE_SECRET` with a real production secret (`wrangler secret put`) failed with `Binding name 'STATE_SECRET' already in use. [code: 10053]` — Cloudflare doesn't allow a `var` and a `secret` to share a binding name on the same Worker. Fixed by removing `STATE_SECRET` from `worker/wrangler.toml`'s `[vars]` and moving the local-dev value to `worker/.dev.vars` (gitignored, Wrangler's standard mechanism for this, loaded automatically by `wrangler dev`), with `worker/.dev.vars.example` committed for onboarding.

That fix passed every local check (`npm test`, and manually re-running `npm run test:e2e`) because `worker/.dev.vars` already existed on disk locally. It still broke CI: a fresh `actions/checkout` doesn't have gitignored files, so `worker/.dev.vars` didn't exist there, `env.STATE_SECRET` was `undefined`, and `wrangler dev`'s Worker crashed on every request with `DataError: Imported HMAC key length (0) must be a non-zero value...` (from `crypto.subtle.importKey` in `worker/src/state.ts`) — which Playwright's `webServer` readiness check saw as a permanently-failing server and gave up on after `Timed out waiting 30000ms from config.webServer.` Reproduced locally by temporarily moving `worker/.dev.vars` out of the way and re-running `npm run test:e2e`. Fixed by adding a `cp worker/.dev.vars.example worker/.dev.vars` step to the `test` job in [ci.yml](../.github/workflows/ci.yml), right before the e2e steps — the same one-time setup the README asks a human contributor to do, just scripted for CI.

**Takeaway**: a gitignored local-config file (`.dev.vars`, `.env`, etc.) that already exists on your machine will make a fix look verified locally while CI — which only ever sees what's actually committed — still fails. Before trusting a local pass for anything gated on a dotfile like this, either delete it and re-run, or trace through what a truly fresh `git clone` would have on disk.
Adding the two secrets got past "Not logged in" but uncovered two more one-time, account-level setup steps that a fresh Cloudflare account needs before `wrangler-action` can ever succeed non-interactively, since neither can be answered from an unattended CI run:

- `pages deploy` failed next with `Project not found. The specified project name does not match any of your existing projects. [code: 8000007]` — a Cloudflare Pages project doesn't get created implicitly by `wrangler pages deploy` in CI; it has to exist first. Fixed by running `npx wrangler pages project create lyrix --production-branch=main` once, locally.
- `wrangler deploy` (the Worker) then failed with `You need to register a workers.dev subdomain before publishing to workers.dev` — the interactive "would you like to register one?" prompt auto-answers "no" in a non-TTY context, which is a hard error rather than a soft default. Fixed by running `npx wrangler deploy --config worker/wrangler.toml` once, locally, and answering "yes" to register a `workers.dev` subdomain for the account.

Both are account-level, not repo-level — one-time, and unrelated to code or secrets.

**Takeaway**: when a failing step logs a deprecation warning right next to the actual error, don't assume they're the same problem — pull the full step log (`gh run view --log-failed`, not just the annotations summary) and read past the warning. Also, getting `wrangler-action` green from a brand-new Cloudflare account takes more than secrets: the API token/account ID, the Pages project, and the `workers.dev` subdomain are three independent one-time setup steps, and CI will fail on each in turn until all three exist — `gh run rerun --failed` after fixing one is the fast way to find the next.

## 2026-09-12 — Setting up the graphify skill: two Windows PowerShell shell gotchas back-to-back

Installing the third-party [Graphify](https://github.com/Graphify-Labs/graphify) Claude Code skill (`graphifyy` on PyPI — turns the repo into a local, offline knowledge graph) required the developer to run a few setup commands by hand, since Claude Code's own auto-mode permission classifier blocks Claude from installing packages or running a freshly-installed executable itself. That surfaced two unrelated Windows-shell issues:

- **PowerShell doesn't auto-execute a quoted path.** `"C:\path\to\graphify.exe" install --project` works in `bash`/`cmd`, but PowerShell parses a leading quoted string as a string *expression*, not a command, and errors on the next token (`Unexpected token 'install'`). Fix: either drop the quotes (safe when the path has no spaces) or prefix with the call operator: `& "C:\path\to\graphify.exe" install --project`.
- **`echo ... > file` in Windows PowerShell 5.1 writes UTF-16LE with a BOM, not UTF-8.** Redirecting `{}` into `.claude/settings.json` this way produced a file that read back as garbled bytes — invalid JSON. Graphify's own `SKILL.md` documents this exact trap for its generated files and works around it with `[System.IO.File]::WriteAllText(path, content, (New-Object System.Text.UTF8Encoding $false))`, which writes plain UTF-8 with no BOM and no extra newline.

**Takeaway**: never hand a Windows/PowerShell user a bare `echo >` or `Out-File` command to produce a file another tool will parse (JSON, YAML, etc.) — Windows PowerShell 5.1 defaults both to UTF-16LE-with-BOM. Use `[System.IO.File]::WriteAllText(...)` with an explicit BOM-less `UTF8Encoding`, or just have them paste the content directly in an editor.

# Learnings

A running log of gotchas, root causes, and anything that cost real time to figure out while building Lyrix. See the "Continuous Improvement Loop" section in [CLAUDE.md](../CLAUDE.md) for how and when to add to this file, and when to promote a recurring entry into a standing rule there instead.

Each entry: date, short title, what happened, how it was resolved.

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

## 2026-09-11 — `deploy` job failing on every push to `main`: two unrelated messages in the same log

Every push to `main` had a red `deploy` job, always showing a "Node.js 20 is deprecated" notice right above the failure, which made it look like the Node version was the cause. It wasn't. `gh run view --log-failed` on the actual run showed the real error a few lines below: `✘ [ERROR] Not logged in.` from `wrangler pages deploy`, then `The process '.../npx' failed with exit code 1`.

Root cause: the repo has no `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets configured at all (confirmed with `gh api repos/<owner>/<repo>/actions/secrets`, which returned `total_count: 0`). `cloudflare/wrangler-action@v3` passes those through as env vars regardless of whether they're set, so with no secrets configured Wrangler runs unauthenticated and fails immediately — nothing to do with the Node runtime.

The "Node.js 20 is deprecated" text is a separate, non-fatal annotation about the *internal* runtime of third-party actions (`actions/checkout@v4`, `actions/setup-node@v4`, `cloudflare/wrangler-action@v3` themselves declare `using: node20` in their own `action.yml`). GitHub forces them onto Node 24 anyway and just logs a warning — it is unrelated to the `node-version:` input we pass to `actions/setup-node`, and changing that input cannot silence it (only the action maintainers releasing an updated `action.yml` can). We still bumped our own `node-version` from 20 to 22 in [ci.yml](../.github/workflows/ci.yml) since Node 20 reached its own end-of-life in April 2026 — a real fix for a real (but separate) problem.

**Takeaway**: when a failing step logs a deprecation warning right next to the actual error, don't assume they're the same problem — pull the full step log (`gh run view --log-failed`, not just the annotations summary) and read past the warning. Deploy secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) must be added under repo Settings → Secrets and variables → Actions before the `deploy` job can ever succeed — no amount of workflow-file editing fixes a missing secret.

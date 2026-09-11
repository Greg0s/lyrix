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

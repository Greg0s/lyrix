# Learnings

A running log of gotchas, root causes, and anything that cost real time to figure out while building Lyrix. See the "Continuous Improvement Loop" section in [CLAUDE.md](../CLAUDE.md) for how and when to add to this file, and when to promote a recurring entry into a standing rule there instead.

Each entry: date, short title, what happened, how it was resolved.

## 2026-09-11 — Playwright `webServer` raced Wrangler's cold start, failing every e2e test

All 3 e2e tests failed with either a 502 from the `/api/round` proxy or a timeout waiting for the guess input. Root cause: `playwright.config.ts` ran `npm run dev:all` (Vite + `wrangler dev` via `concurrently`) as a single `webServer` entry and only polled `http://localhost:5173` for readiness. Vite is ready in ~200ms, but `wrangler dev` needs a few seconds to boot its local `workerd` runtime — Playwright started firing requests the moment Vite answered, well before the Worker was listening, and Vite's dev proxy turned the resulting `ECONNREFUSED` into a 502.

Fixed by splitting `webServer` into two entries (`npm run dev` / `npm run dev:worker`), each polled on its own URL — Playwright's readiness check only accepts HTTP status `200–403`, so a 502 correctly keeps it polling instead of starting tests early. This is also the pattern the Playwright docs recommend for a frontend+backend setup.

**Takeaway**: when a `webServer` command starts multiple processes on different ports, give Playwright one entry per port. A single combined command + one URL only proves the fastest process is up.

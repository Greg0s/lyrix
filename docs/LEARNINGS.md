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

## 2026-09-11 — Wiring up the real LRCLIB API: three gotchas

While replacing the two hardcoded placeholder songs with live LRCLIB lookups (`worker/src/lrclib.ts`, `lyrics.ts`, `songs.ts`):

- **`/api/get` is the wrong endpoint for a curated catalog.** It needs an exact `track_name` + `artist_name` match (duration within ±2s if given) and 404s on anything less than exact — fragile against our own catalog strings potentially not matching LRCLIB's stored title/artist casing exactly. `/api/search?track_name=&artist_name=` is fuzzier, returns up to 20 ranked candidates, and doesn't require duration. Switched to `/api/search` and pick the best candidate ourselves (prefer an exact artist-name match after `normalize()`, else the first usable result).
- **LRCLIB requires a client identifier.** Per `https://lrclib.net/docs`, every request must identify the calling application via `User-Agent` (or `Lrclib-Client`/`X-User-Agent` as alternatives). `worker/src/lrclib.ts` sends a fixed `Lrclib-Client` header for this.
- **LRCLIB's metadata fields aren't guaranteed clean.** A live `/api/search?track_name=Papaoutai&artist_name=Stromae` call returned `trackName: "papaoutaiPapaoutai"` — two title variants joined by a stray unit-separator control character. Because of this, the puzzle's displayed title/artist always come from our own curated `catalog.ts` strings, never from LRCLIB's `trackName`/`name`/`artistName` fields (LRCLIB is used only as the source of `plainLyrics`), and `lyrics.ts`'s `sanitize()` strips any other control character below code point 32 (keeping tab/newline) before the text ever reaches `parseSections`.

Regression coverage: `tests/unit/worker/lrclib.test.ts` (parsing/matching), `tests/unit/worker/lyrics.test.ts` (the control-character case, using the exact byte observed live), `tests/unit/worker/guess.test.ts` (fallback chain when the daily pick fails).

Related: the Workers Cache API (`worker/src/cache.ts`, used to avoid re-fetching LRCLIB on every request) only exists in the real Workers runtime, not under plain-Node Vitest. Guarded with `typeof caches === "undefined"` so it silently no-ops (falls back to "always fetch fresh") in unit tests instead of needing a test-only code path.

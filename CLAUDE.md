# CLAUDE.md

This file gives Claude Code the context and rules needed to work on this project. Keep it in English and keep it up to date — see "Continuous Improvement Loop" below.

## Project Overview

A free web game inspired by Pedantix, built around song lyrics instead of Wikipedia articles. The player types words to progressively reveal a song's lyrics; the round is won once the title is fully uncovered.

- One song per day, same puzzle for everyone (Motus/Wordle-style), rotating at UTC midnight from a curated catalog (`worker/src/catalog.ts`). No "replay with a different song" — once solved, the player waits for tomorrow's.
- Target audience: French-speaking, tech-savvy web users. No user accounts or personal data in the MVP.
- Project name: **Lyrix**.

## Current Phase: MVP (no 3D)

Plain, functional UI — no 3D, no fancy animations. Do not add 3D dependencies (`three`, `@react-three/fiber`, `@react-three/drei`) unless explicitly asked; 3D is a planned post-MVP phase (see "Out of Scope"). MVP scope: masked lyrics (blanks matching word length, punctuation/line breaks preserved), a text input that reveals every occurrence of a correctly guessed word, and a win state once the title is fully uncovered.

## Tech Stack

- **Frontend**: Vite + React, TypeScript strict mode.
- **Backend**: Cloudflare Workers + Hono. Keeps the target lyrics secret server-side — never expose the full lyrics text to the client, even hidden or obfuscated in the bundle or a response.
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Workers (API).
- **Lyrics source**: LRCLIB (lrclib.net), queried server-side via `/api/search` (not `/api/get` — see `docs/LEARNINGS.md`), cached per catalog id with the Workers Cache API (`worker/src/cache.ts`).
- **Database**: none. Cloudflare D1 is reserved for a later phase (accounts, leaderboard) — do not add it now. Workers KV holds only the precomputed similarity tables (see below), not application data.
- **Semantic proximity scoring**: French word embeddings, precomputed offline into a per-song score table — see `docs/SIMILARITY.md`.
- **Planned, not yet in scope**: `@react-three/fiber`/`@react-three/drei` for in-game 3D; team mode; word-usage counter.

## Working on this project

- Install: `npm install`
- Run: `npm run dev:all` (Vite + `wrangler dev` side by side; `/api/*` is proxied to the Worker)
- Test: `npm test` (lint + typecheck + Vitest), `npm run test:e2e` (Playwright)
- Play against real proximity scores instead of the dev placeholder: `npm run dev:similarity`

## TypeScript Rules

- `strict: true` for both the frontend and the Worker (`tsconfig.json`, `worker/tsconfig.json`).
- Never use `any`. If a type is genuinely unknown (an external API response), use `unknown` and narrow it, or write a proper interface — including for LRCLIB responses. Enforced by `@typescript-eslint/no-explicit-any` as a lint error, and `npm test` runs the linter.

## Language Policy

Everything in this repository is in English: code, comments, identifiers, commit messages, documentation, this file. The developer communicates with Claude in French in chat — that's fine — but anything written to the repository must be in English.

## Git Workflow & Commit Convention

Conventional Commits + Gitmoji: `<gitmoji> <type>(<optional scope>): <short description in English, imperative mood>`

| Gitmoji | Type     | Use for                                                 |
| ------- | -------- | ------------------------------------------------------- |
| ✨      | feat     | A new feature                                           |
| 🐛      | fix      | A bug fix                                               |
| ♻️      | refactor | Code change that neither fixes a bug nor adds a feature |
| ✅      | test     | Adding or correcting tests                              |
| 📝      | docs     | Documentation only (including this file)                |
| 🔧      | chore    | Tooling, config, dependency bumps                       |
| ⚡️      | perf     | Performance improvement                                 |
| 👷      | ci       | CI/CD pipeline changes                                  |
| 💄      | style    | UI/visual-only change, no logic change                  |
| 🔥      | remove   | Removing code, files, or dead features                  |

Example: `🐛 fix(matching): ignore accents when comparing guesses`

- One logical change per commit. Commit body explains _why_ when the change isn't obvious from the diff.
- Never commit secrets, API tokens, or `.env` files.

## Testing Philosophy

Never test manually when it can be scripted instead — this applies to the developer and to Claude equally. Don't verify your own work with one-off ad-hoc checks either (a throwaway `curl`, temporary `console.log`, clicking through by hand): if a check is worth doing, script it and add it to the suite. Every feature or fix needs an automated way to verify it, runnable as a single command.

- **Unit tests** (Vitest): game logic (word masking, matching, French text normalization) and Worker request handlers, decoupled from any rendering concern.
- **Component tests** (Vitest + jsdom + Testing Library, `tests/unit/components`): what a React change does to the player's experience — above all how much of the page a keystroke re-renders. Assert on counted work (renders, reads, writes), never timings.
- **End-to-end tests** (Playwright): the real player flow. Assert against the DOM/game state, not visual output. `npm run test:e2e` starts its own Vite/Worker instances on dedicated ports and never reuses a server already running — see `tests/unit/ci/e2e-servers.test.ts` if a run fails with "already in use".
- Before marking a task done, run the relevant test script(s) yourself and report the result. If a check isn't yet scripted, write that script first.
- Every bug fix adds a regression test that would have caught it, in the same commit as the fix.
- CI (`.github/workflows/ci.yml`) runs the full suite on every push/PR, and deploys on merge to `main`.

## Performance

The game's own logic is cheap; everything that has ever been slow here was correct work repeated for a value that hadn't changed.

- **Nothing in the Worker's per-guess path may scale with the length of the song.** A song is immutable once resolved, so anything derived from it — tokenization (`src/game/analyze.ts`), the resolved song, the parsed similarity table, the HMAC key — is derived once and memoized per isolate. When adding an isolate-level cache, add its `reset*()` and call it from the affected tests' `beforeEach` in the same commit.
- **Typing a guess must not re-render the lyrics.** Derived state goes through `useMemo` keyed on what it actually reads; components that display it are `memo()`d.
- **Measure before and after, and pin the result with a test that counts the work** — tokenization calls, KV reads, tokens re-rendered per keystroke. Never assert on elapsed time; an unpinned fix comes straight back.

## Continuous Improvement Loop

Keep `docs/LEARNINGS.md` as a running log of things worth remembering across sessions:

1. When you hit a gotcha (an LRCLIB quirk, a French-text-matching edge case, a Wrangler/Cloudflare detail, anything that cost real time), append a short, dated entry.
2. When you fix a bug, note the root cause there too, alongside the regression test added for it.
3. Periodically (or when asked to "review learnings"), re-read it: if the same category of mistake shows up more than once, turn it into an explicit rule in this file instead of leaving it as a log entry.
4. Treat this loop as making the fix permanent, not as a substitute for fixing the root cause first.

## Domain-Specific Rules

- **Anti-cheat is a hard requirement**, even in the MVP: the Worker is the only thing that knows the actual lyrics. It receives a guessed word and returns which positions match — never the full text before the round is won. The one exception is `DEV_REVEAL_LYRICS` (`worker/src/index.ts`), which attaches each hidden word's real text as `devHint` for local debugging (`WordToken.tsx`); wired only into `dev:worker`/`dev:all`/`test:e2e`, never in `wrangler.toml` or production.
- **The "show all lyrics" checkbox reuses that same mechanism, gated on `victory` instead of a dev flag.** Once `RoundView.victory` is true — recomputed by the Worker itself from signed state, never client-supplied — `buildRoundView` attaches every still-hidden lyrics word's real text as `DisplayToken.revealHint`, riding along on the normal round/guess response (no extra endpoint or round trip). The checkbox itself is local, unsigned UI state owned by `GameScreen`, rendered only once won (`TitleGuess`); `WordToken` shows `revealHint` in place of a blank only while checked, ahead of a close-guess placement and the dev hint.
- **French text matching**: normalize both the guess and the stored lyrics before comparing (case/accent-insensitive, œ/æ spelled out) and account for elisions ("j'aime" vs "je aime", "qu'il", "l'amour"). `LETTER_CLASS` (`src/game/tokenize.ts`) must cover every letter French lyrics use. A run of digits is a word too.
- **LRCLIB data isn't guaranteed clean**: handle missing lyrics, instrumental sections, and inconsistent formatting gracefully.

## Semantic Proximity Scoring

Cemantix-style hinting: a guess that isn't in the lyrics comes back with a 0-100 proximity score, and one close enough to a hidden word is shown in its place, shaded by closeness, until a closer guess or the word itself takes the slot back. The table is precomputed **offline** per song (`npm run similarity:build`); the guess-time path is one KV read plus a couple of lookups — never add runtime inference (including Workers AI) to it. **Only numbers ever cross the wire**: a missed guess's score plus the positions of hidden words it's close to, never their text. With no `SIMILARITY` namespace bound, every score is `null` and the game behaves exactly as before scoring existed — that must stay true.

Full pipeline, commands, scoring rules and model licensing: **`docs/SIMILARITY.md`**. Player-facing setup steps: `README.md`.

## Out of Scope (do not implement without an explicit request)

- Any 3D code or dependency (`three`, `@react-three/fiber`, `@react-three/drei`).
- Team mode, word-usage counter (V2).
- User accounts, authentication, leaderboard, Cloudflare D1 (V3).
- Monetization of any kind.

## Project Structure

```
/src
  main.tsx, App.tsx     # React entry point, top-level render of GameScreen
  roundStorage.ts        # localStorage persistence so a reload resumes today's round
                          # (deferred/idle writes, flushed on tab hide/close)
  /api/client.ts         # fetch wrapper (fetchRound, submitGuess)
  /components             # presentational React components
    GameScreen.tsx        # top-level layout; wires useGame()/useIsMobile(), places close
                           # guesses onto the round (slots.ts), and owns the "show all
                           # lyrics" checkbox's local, unsigned reveal-all toggle
    TitleGuess.tsx         # masked title, victory banner, and the "show all lyrics"
                           # checkbox once won (RoundView.victory), controlled by GameScreen
    LyricsBody.tsx          # masked lyrics, grouped by section; takes the reveal-all toggle
    WordToken.tsx           # one token: punctuation, found word, blank, close-guess blank,
                            # revealed-via-checkbox text (DisplayToken.revealHint), dev hint
    heatStyle.ts             # inline --heat a scored word is shaded with
    GuessForm.tsx             # word-guess input
    TriedWords.tsx             # past guesses, sorted by score; credits the embedding model
    SideCard.tsx, HowToPlay.tsx # collapsible panel shell, static rules text
  /hooks
    useGame.ts              # round/guess state machine; hydrates from roundStorage before network
    useIsMobile.ts            # 760px breakpoint via matchMedia, drives SideCard collapse
  /game                       # masking/matching/normalization — framework-agnostic, unit-tested,
                               # imported by BOTH the frontend and the Worker
    types.ts, tokenize.ts, normalize.ts  # wire contract; word/non-word tokenizer (elisions,
                                          # digit runs); case/accent-insensitive matching key
    analyze.ts               # one tokenize+normalize pass per song, memoized (see "Performance")
    mask.ts                   # masked DisplayToken views + victory check
    similarity.ts, functionWords.ts, slots.ts  # 0-100 proximity scale; excluded function words;
                                                # addressing hidden words by position
  /styles                    # tokens.css, global.css, game.css
/worker/src
  index.ts                  # Hono app: GET /api/round, POST /api/guess
  catalog.ts                  # curated {id, artist, title} list + deterministic daily pick
  lrclib.ts, lyrics.ts          # LRCLIB /api/search client; plain-text/section parsing
  cache.ts                       # Workers Cache API wrapper, no-ops under plain-Node Vitest
  resolveSong.ts, songs.ts         # catalog entry -> playable Song; isolate memo, fallback chain,
                                    # hardcoded emergency song for a total LRCLIB outage
  similarity.ts, sampleSimilarity.ts # reads the precomputed KV table per guess; dev/e2e placeholder
  state.ts                            # HMAC-signed round state (songId + foundKeys) via Web Crypto
/worker
  wrangler.toml              # Worker config; STATE_SECRET dev default, SIMILARITY binding (commented)
  wrangler.similarity.toml    # same Worker + a local-only SIMILARITY namespace (npm run dev:similarity)
/scripts                     # Node tooling via tsx, never bundled into the Worker
  ensure-dev-vars.ts, convert-embeddings.ts, build-similarity-table.ts,
  dev-similarity.ts, inspect-similarity-table.ts
  /lib/embeddings.ts, vocabulary.ts, similarityTable.ts, localSimilarity.ts, devVars.ts
/tests
  /unit/game, /unit/worker, /unit/scripts, /unit/storage, /unit/components, /unit/ci
  /e2e                        # Playwright; fixtures/similarity-table.json stands in for a built table
/docs
  LEARNINGS.md, SIMILARITY.md
```

**Anti-cheat shape**: the Worker is the only code that ever sees unmasked lyrics. Every response sends already-masked display tokens plus an opaque HMAC-signed `state` string encoding found words so far; the client only echoes it back. This keeps the Worker stateless while making forged "already found" progress impossible.

**Dev wiring**: `vite.config.ts` proxies `/api/*` to the Worker at `localhost:8787`, so the frontend always calls a relative `/api/...` URL in dev and production. `src/game` is not a published package — the root and Worker `tsconfig.json` each `include` it by relative path, so Vite and Wrangler bundle it independently from the same source.

## Configuration

`STATE_SECRET` (the key the Worker signs round state with) is the only secret the app needs. Local dev reads it from `worker/.dev.vars` (created automatically by `predev:worker`), production from `wrangler secret put STATE_SECRET`. It is deliberately **not** in `wrangler.toml`: Cloudflare rejects a `var` and a `secret` sharing one binding name.

Two standing rules — a missing `worker/.dev.vars` has broken CI once and a developer's machine once, both times as an opaque Web Crypto `DataError`:

- **A gitignored config file is never a manual setup step.** Script its creation and hang the script off the command that needs it. A README step is a step someone will skip, and CI skips it every time.
- **Missing configuration must name itself.** Anything read from `env` is checked where it is read, with an error naming which variable is missing and how to set it, in both dev and production.

## Deployment

- Frontend to Cloudflare Pages, API to Cloudflare Workers, via Wrangler.
- GitHub Actions: run tests, then deploy on merge to `main`.

## graphify

This project can maintain a knowledge graph at `graphify-out/` (god nodes, community structure, cross-file relationships) via the `/graphify` skill — not yet built; run `/graphify .` to generate it before relying on these rules.

- For codebase questions, first run `graphify query "<question>"` once `graphify-out/graph.json` exists; `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain don't surface enough.
- After modifying code, run `graphify update .` to keep the graph current.

## Reference docs

- `docs/LEARNINGS.md` — dated log of gotchas and bug root causes; read before repeating past mistakes, write to after finding a new one.
- `docs/SIMILARITY.md` — full semantic proximity scoring pipeline, tuning constants, and rules; read before touching similarity/scoring code.

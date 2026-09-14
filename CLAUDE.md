# CLAUDE.md

This file gives Claude Code the context and rules needed to work on this project. Keep it in English and keep it up to date — see "Continuous Improvement Loop" below.

## Project Overview

A free web game inspired by Pedantix, built around song lyrics instead of Wikipedia articles. The player types words to progressively reveal a song's lyrics; the round is won once the title is fully uncovered.

- One song per day: every player gets the same puzzle (Motus/Wordle-style), rotating at UTC midnight from a curated catalog (`worker/src/catalog.ts`). There is no "replay with a different song" — once solved, the player waits for tomorrow's song.
- Target audience: French-speaking, tech-savvy web users.
- No user accounts or personal data in the MVP.
- Project name: TBD — update this section once decided.

## Current Phase: MVP (no 3D)

We are building the MVP first, with a plain, functional UI — no 3D, no fancy animations. Do not add 3D dependencies, components, or packages (`three`, `@react-three/fiber`, `@react-three/drei`) unless explicitly asked. 3D is a planned post-MVP phase (see "Out of Scope").

MVP scope only:

- Masked lyrics display (hidden words shown as blanks matching word length; punctuation and line breaks preserved).
- A text input to guess words; every occurrence of a correctly guessed word is revealed.
- A win state once the full title is uncovered.

## Tech Stack

- **Frontend**: Vite + React, TypeScript in strict mode.
- **Backend**: Cloudflare Workers with the Hono framework. It keeps the target lyrics secret server-side and only returns revealed words/positions to the client. Never expose the full lyrics text to the client in any form, even hidden or obfuscated in the bundle or a network response.
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Workers (API).
- **Lyrics source**: LRCLIB (lrclib.net) — free, keyless API, queried server-side (`worker/src/lrclib.ts`, via `/api/search`, not `/api/get` — see `docs/LEARNINGS.md`) for whichever song `worker/src/catalog.ts` picks for the day. What comes back is crowd-sourced and gets cleaned before it is ever masked (`worker/src/lyrics.ts`); `npm run catalog:check` asks LRCLIB for the whole catalog and reports what it gets. Resolved songs are cached per catalog id with the Workers Cache API (`worker/src/cache.ts`), so a given day triggers only a handful of LRCLIB calls rather than one per player. Optionally the Genius API for song search/autocomplete metadata only (Genius does not provide lyrics text itself) — not wired up, and nothing needs it while the MVP serves one song a day with no song search.
- **Database**: none needed for the MVP. Cloudflare D1 is reserved for a later phase (accounts, leaderboard) — do not add it now. Cloudflare Workers KV holds the precomputed semantic-similarity tables (see "Semantic proximity scoring" below); it is a read-only lookup table built offline, not an application database.
- **Semantic proximity scoring**: French word embeddings (frWac2Vec), precomputed offline into a per-song word → score table that also lists the song words each word is close to. See the dedicated section below.
- **Planned, not yet in scope**: `@react-three/fiber` + `@react-three/drei` for in-game 3D (paper sheet, scrollable in-scene computer screen, in-scene settings menu); team mode; word-usage counter.

## TypeScript Rules

- `strict: true` in `tsconfig.json`, for both the frontend and the Worker.
- Never use `any`. If a type is genuinely unknown (e.g. an external API response), use `unknown` and narrow it, or write a proper type/interface for it — including for LRCLIB and Genius API responses.
- Enforce this automatically: enable `@typescript-eslint/no-explicit-any` as a lint error (not a warning), and run the linter as part of the test script(s) rather than as a manual review step.

## Language Policy

Everything in this repository is in English: code, comments, identifiers, commit messages, documentation, and this file. The developer communicates with Claude in French in chat — that's fine, but anything written to the repository must be in English.

## Git Workflow & Commit Convention

Conventional Commits + Gitmoji, in this format:

```
<gitmoji> <type>(<optional scope>): <short description in English, imperative mood>
```

Common types used in this project:

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

Examples:

- `✨ feat(game): reveal all occurrences of a guessed word`
- `🐛 fix(matching): ignore accents when comparing guesses`
- `✅ test(worker): cover word-reveal endpoint with malformed input`

Rules:

- One logical change per commit.
- Commit body explains _why_ when the change isn't obvious from the diff.
- Never commit secrets, API tokens, or `.env` files.

## Testing Philosophy

Never test manually when it can be scripted instead — this applies to the developer and to Claude equally. Don't verify your own work with one-off ad-hoc checks either (a throwaway `curl` call, temporary `console.log` debugging, clicking through the app by hand): if a check is worth doing, turn it into a script and add it to the suite, so it's still there the next time the same thing needs verifying. Every feature or fix should come with an automated way to verify it, runnable as a single command.

- **Unit tests**: Vitest, for game logic (word masking, matching, French text normalization — accents, elisions like "j'", "qu'") and Worker request handlers. Keep this logic decoupled from any rendering concern (including future 3D) so it stays testable in isolation.
- **End-to-end tests**: Playwright, for the actual player flow (load game, type a guess, see it revealed, win the round). Assert against the DOM/game state, not visual/pixel output.
- **E2E runs against its own servers**: `npm run test:e2e` starts a fresh Vite dev server on port 15173 and Worker on 18787 (inspector 19229) — Vite's `/api` proxy follows it there through `API_PROXY_TARGET` — and never reuses a server that is already running, so it always tests this checkout's code while `npm run dev:all` (5173/8787) stays up here or in any other clone or worktree. Keep it that way: Playwright's readiness check only proves that *something* answers on a port, not which checkout started it. If a run stops with "… is already used", stop whatever holds the port instead of turning `reuseExistingServer` back on. Guarded by `tests/unit/ci/e2e-servers.test.ts`.
- **Before marking a task done**: run the relevant test script(s) yourself (`npm test`, `npm run test:e2e`) and report the result. If verifying the task requires a check that isn't yet scripted, write that script first, then run it — don't verify by hand and move on.
- **Every bug fix** must add a regression test that would have caught it, in the same commit as the fix.
- **CI**: GitHub Actions runs the full test suite on every push/PR, before deployment.

## Continuous Improvement Loop

Keep a `docs/LEARNINGS.md` file (create it if it doesn't exist) as a running log of things worth remembering across sessions:

1. **When you hit a gotcha** (an LRCLIB quirk, a French-text-matching edge case, a Wrangler/Cloudflare deployment detail, anything that cost real time to figure out), append a short, dated entry to `docs/LEARNINGS.md` explaining what happened and how it was resolved.
2. **When you fix a bug**, note the root cause there too, alongside the regression test added for it.
3. **Periodically** (or when asked to "review learnings"), re-read `docs/LEARNINGS.md`: if the same category of mistake shows up more than once, turn it into an explicit rule in this file (CLAUDE.md) instead of leaving it as a log entry — the log is for one-off notes, this file is for standing rules.
4. Treat this loop as making the fix permanent, not as a substitute for actually fixing the root cause first.

## Domain-Specific Rules

- **Anti-cheat is a hard requirement**, even in the MVP: the Worker is the only thing that knows the actual lyrics. It receives a guessed word and returns which positions match — it never returns, and the client never receives, the full text before the round is won.
- **French text matching**: normalize both the guess and the stored lyrics before comparing (case-insensitive, accent-insensitive) and account for French elisions ("j'aime" vs "je aime", "qu'il", "l'amour") so a correct guess isn't missed due to punctuation attached to the word.
- **LRCLIB data isn't guaranteed clean**: handle missing lyrics, instrumental sections, and inconsistent formatting gracefully rather than assuming every response is well-formed. Everything that isn't sung is dropped before masking (`cleanLyrics`), and a result too thin to be a puzzle is refused so the day's pick falls through to the next catalog entry (`MIN_LYRIC_WORDS`) — a player must never be asked to guess `[Refrain]`, `♪`, or the artist's own name out of an `[ar:…]` tag.
- **The catalog is only as good as LRCLIB's copy of it**: a hand-written entry can stop resolving without a line of this repository changing, and the unit suite mocks the network on purpose, so nothing in CI can tell you. Run `npm run catalog:check` after editing `worker/src/catalog.ts`, and whenever a day's round looks wrong.

## Semantic Proximity Scoring

Cemantix-style hinting: every guess that is *not* in the lyrics comes back with a 0-100 proximity score, so the player can tell "wrong, but you're circling it" from "wrong, and nowhere near". Pedantix-style on top of that: a guess that is close to hidden words is shown in their place in the lyrics (and the title), coloured by how close it is, until a closer guess — or the word itself — takes the slot back.

**The scoring never happens at request time.** Embeddings are heavy and a Worker has milliseconds; instead, a table is precomputed offline per song and the Worker does one KV read plus a couple of property lookups per guess. Do not add runtime inference (including Workers AI) to the guess path.

### Pipeline

1. **Model** — [frWac2Vec](https://fauconnier.github.io/#data) by Jean-Philippe Fauconnier, variant `frWac_no_postag_no_phrase_200_cut100` (200 dimensions, skip-gram, no POS tagging, frequency cutoff 100). No POS tagging means a word maps straight to a vector, with no tagging step before the lookup. It is **not** committed to this repo and not downloaded automatically — see "Model licensing" below.
2. **Convert** — `npm run similarity:convert` rewrites the model into the compact `.vecbin` format (`scripts/lib/embeddings.ts`): L2-normalized rows, one indexable vocabulary block, `--max-words` to drop the rare tail. Scoring is then a plain dot product.
3. **Build** — `npm run similarity:build` resolves a song's lyrics (LRCLIB, same path the Worker uses), tokenizes and normalizes them with `src/game/tokenize.ts` + `src/game/normalize.ts`, and scores every reference word by its **maximum** cosine similarity against any word of the song (`scores`). The same pass keeps, for each reference word, the song words it scores at least `NEAR_SCORE` against — closest first, at most `MAX_NEAR_TARGETS` (`scripts/lib/similarityTable.ts`) — as `near`. Output: one `data/similarity/<songId>.json` per song. The build log prints each table's size: the Worker parses a whole table on every guess, so watch it when tuning `MAX_NEAR_TARGETS`.
4. **Upload** — `wrangler kv bulk put` into the `SIMILARITY` namespace, keyed by song id.
5. **Serve** — `worker/src/similarity.ts` reads the table for the song in play and answers with the guess's score plus `near`: the positions of the still-hidden words it is close to, each with its own score. The frontend then shows every hidden word's closest guess so far in its place (`src/game/slots.ts`).

### Commands

```bash
# one-off: compact the downloaded model
npm run similarity:convert -- --input data/models/frWac_no_postag_no_phrase_200_cut100.bin \
                              --output data/models/frwac.vecbin --max-words 200000

# whenever a song joins the catalog (or for the whole catalog)
npm run similarity:build -- --model data/models/frwac.vecbin --song papaoutai
npm run similarity:build -- --model data/models/frwac.vecbin --all --bulk

# upload (after creating the namespace, see worker/wrangler.toml)
npx wrangler kv bulk put data/similarity/bulk.json --binding SIMILARITY --remote --config worker/wrangler.toml
```

`npm run similarity:build -- --help` lists the rest (`--vocabulary` for a Lexique383-style common-word list, `--max-vocabulary`, `--lyrics` to build from a local file without calling LRCLIB).

### Rules

- **Only numbers cross the wire.** A missed guess gets its own score, plus the positions of the hidden words it is close to with a score each — never the text of the word at a position, a vector, a rank, or any slice of the table beyond the typed word's own entry. A guess that *is* in the lyrics scores 100 without a lookup and is placed nowhere, which leaks nothing the existing `found` flag didn't already.
- **Hidden words are addressed by position, never by an id.** `src/game/slots.ts` counts every word of the round, the title's first, then the lyrics' in reading order. `wordPositions` (Worker side) and `placeNearGuesses` (frontend side) must keep counting the same way, and a unit test runs them against each other. Don't stamp an id on every masked token instead: it would tell the player which blanks hide the same word before they have come close to any of them.
- **Placement is display, not progress.** Which guess sits on which hidden word is derived on the client from the tried-word list — the closest guess wins, a tie keeps the earlier one, a revealed word always shows itself — and saved with that list by `roundStorage.ts`. It never enters the signed round state: a forged placement only fools the player who forged it.
- **`NEAR_SCORE` is pegged to the warm tier**, so a guess whose chip is warm or hot always lands somewhere, unless everything it is close to is already revealed. The build drops pairs below it, so lowering it means rebuilding the tables; the Worker checks it again on every read, so raising it doesn't. Any change to the table's shape bumps `SIMILARITY_TABLE_VERSION` (currently 2): older tables are then ignored rather than half-read, and have to be rebuilt.
- **The feature is optional at runtime.** With no `SIMILARITY` namespace bound, every score is `null`, nothing is placed, and the game behaves exactly as it did before scoring existed. Keep it that way: a missing table is never an error.
- **Reference vocabulary**: the model's vocabulary intersected with a common-word list (default: the model's own frequency order, capped at 50 000), proper nouns excluded, plus the song's own words forced in however rare they are.
- **Normalization must stay in step.** Table keys go through the same `normalize()` as a player's guess (lowercase, accents stripped), so one key can cover several model forms — the best-scoring one wins. Changing `normalize.ts` invalidates every stored table; rebuild them.
- **Local development uses placeholder scores.** `npm run dev:worker` passes `--var SIMILARITY_SAMPLE:1`, which serves the hand-written table in `worker/src/sampleSimilarity.ts` so the UI and the e2e suite work without the model or a KV namespace. That flag is never set in production, and a real KV table always wins over it. The table only covers a few dozen words, so the Worker prints the whole list to its log the first time it serves one — keep it that way, or the only way to test the feature is to read the source. Its placements are arbitrary but stable: each sample word scoring `NEAR_SCORE` or more lands on one or two words of the day's song, picked by hashing it — so e2e tests assert on *how* a close word shows up, never on *where*.

### Model licensing — unresolved, read before shipping

frWac2Vec's reuse terms were never checked, and nothing in this repository resolves them. What the code does today:

- the model is **not** committed, **not** vendored, and **never** downloaded automatically — someone has to fetch it by hand;
- `data/models/` and `data/similarity/` are gitignored, so neither the model nor tables derived from it enter git;
- only derived numbers (word → score) would ever reach Cloudflare KV, never the vectors themselves.

That keeps the repository clean either way, but **uploading a derived table to production is still a redistribution question**. Check frWac2Vec's licence (and that of any word list used with `--vocabulary`, e.g. Lexique383) before enabling the KV namespace. If the terms don't allow it, the pipeline takes any word2vec-format model — swap in a permissively licensed one and rebuild; nothing outside `--model` changes.

## Out of Scope (do not implement without an explicit request)

- Any 3D code or dependency (`three`, `@react-three/fiber`, `@react-three/drei`).
- Team mode, word-usage counter (V2).
- User accounts, authentication, leaderboard, Cloudflare D1 (V3).
- Monetization of any kind.

## Project Structure

```
/src
  main.tsx          # React entry point (mounts <App />)
  App.tsx           # renders GameScreen
  roundStorage.ts   # localStorage persistence for today's round (todayKey/loadSavedRound/saveRound),
                    # so a page reload resumes progress instead of restarting the daily song
  /api
    client.ts       # fetch wrapper the frontend uses to call the Worker (fetchRound, submitGuess)
  /components       # presentational React components
    GameScreen.tsx  # top-level layout; wires useGame()/useIsMobile() into the rest, and lays each
                    # hidden word's closest guess onto the round (slots.ts) before rendering it
    TitleGuess.tsx  # masked title, victory banner ("come back tomorrow" note once solved)
    LyricsBody.tsx  # masked lyrics, grouped by section
    WordToken.tsx   # one title/lyrics token: punctuation, found word, blank, or blank holding a close guess
    GuessForm.tsx   # word-guess input
    TriedWords.tsx  # past guesses: found vs. missed, proximity colour + score, sorted by score
    SideCard.tsx    # collapsible card shell, used for both side panels
    HowToPlay.tsx   # static rules text
  /hooks
    useGame.ts      # round/guess state machine; calls fetchRound/submitGuess, hydrates from
                    # roundStorage.ts before ever hitting the network, and persists after each change.
                    # Each tried word keeps its score and the hidden positions it is close to
    useIsMobile.ts  # 760px breakpoint match, drives SideCard collapse on mobile
  /game             # masking, matching, normalization — framework-agnostic, unit-tested,
                    # imported by BOTH the frontend (src) and the Worker (worker/src)
    types.ts        # Song (server-only) + the RoundView/GuessResult wire contract, NearSlot included
    tokenize.ts     # splits text into word/non-word runs (keeps elisions like "l'amour" guessable)
    normalize.ts    # case/accent-insensitive key used for matching
    mask.ts         # builds masked DisplayToken views from a Song + found keys, checks victory
    similarity.ts   # the 0-100 proximity scale: cosine -> score, score -> colour tier, tried-word
                    # sorting, NEAR_SCORE. No embedding maths — that only ever runs offline, in /scripts
    slots.ts        # addressing hidden words by position: wordPositions (Worker side), the closest
                    # guess per hidden word, and placeNearGuesses (frontend side)
  /styles           # tokens.css (design tokens), global.css (reset/fonts), game.css
/worker
  /src
    index.ts      # Hono app: GET /api/round, POST /api/guess
    catalog.ts    # curated {id, artist, title} list + pickDailyEntry/catalogRotation — a
                   # deterministic day-of-epoch pick, so "today's song" needs no stored state
    lrclib.ts     # LRCLIB /api/search client: response parsing/validation + artist-match ranking
    lyrics.ts     # pure text parsing: plainLyricsFrom (prefers plainLyrics, falls back to synced),
                  # cleanLyrics (drops what isn't sung: LRC timestamps and id tags, bracketed section
                  # headers, instrumental filler) and parseSections (paragraphs -> Section[])
    cache.ts      # Workers Cache API wrapper (getCachedSong/putCachedSong); no-ops outside the
                  # real Workers runtime so callers stay testable under plain-Node Vitest
    resolveSong.ts # one catalog entry -> a playable Song via LRCLIB, or null when what comes back
                  # isn't worth playing (MIN_LYRIC_WORDS), so the caller tries the next candidate.
                  # Split out of songs.ts so it stays free of Workers-only globals: the offline
                  # similarity-table builder reuses it under Node
    songs.ts      # secret lyrics data — never imported from /src. getSongById resolves one
                  # catalog id (cache -> LRCLIB -> parse); getTodaysSong adds the daily pick,
                  # a fallback chain across the catalog, and a hardcoded emergency song for a
                  # total LRCLIB outage
    similarity.ts # reads the precomputed table for a song from Workers KV and answers each guess
                  # with its score plus the positions of the hidden words it is close to; degrades
                  # to "no score, no placement" when unbound or broken
    sampleSimilarity.ts # hand-written placeholder scores (and hash-picked placements) for dev/e2e,
                  # gated on SIMILARITY_SAMPLE
    state.ts      # HMAC-signed round state (songId + foundKeys) via Web Crypto, so the
                  # stateless Worker can't be tricked into trusting client-forged progress
  wrangler.toml   # Worker config; STATE_SECRET dev default lives here, prod uses `wrangler secret put`;
                  # also holds the commented-out SIMILARITY KV binding and how to enable it
  tsconfig.json   # Worker's own compiler options (Workers lib/types), separate from the root tsconfig
/scripts          # Node tooling run through tsx — never bundled into the Worker
  ensure-dev-vars.ts         # creates worker/.dev.vars from its example; npm's predev:worker hook
  check-catalog.ts           # asks LRCLIB for every catalog entry and reports what comes back
  convert-embeddings.ts      # word2vec (text or binary) -> the compact .vecbin format
  build-similarity-table.ts  # song(s) + model -> data/similarity/<songId>.json, ready for KV
  /lib
    devVars.ts         # copy-if-absent helper behind ensure-dev-vars.ts
    catalogAudit.ts    # pure reporting behind check-catalog.ts: per-entry verdict, leftover-formatting
                       # warnings, duplicate catalog ids
    embeddings.ts      # word2vec/compact readers + writers, L2 normalization, dot product
    vocabulary.ts      # normalized key index, proper-noun filtering, reference-word selection
    similarityTable.ts # pure scoring: reference word -> max cosine against the song's words, plus
                       # the song words it is close to
/tests
  /unit/game    # Vitest: tokenize/normalize/mask/similarity/slots
  /unit/worker  # Vitest: catalog rotation, LRCLIB parsing, lyrics cleanup, song resolution, Hono routes
                # (exercised via app.request() against a mocked fetch), state signing,
                # similarity-table lookup against a fake KV namespace
  /unit/scripts # Vitest: the offline pipeline, against a 3-dimension fixture model (no real model in
                # CI), and the catalog audit's reporting
  /unit/storage # Vitest: roundStorage save/load against a fake Storage
  /unit/ci      # Vitest: tooling config — deploy-job env, e2e server ports/reuse/proxy wiring
  /e2e          # Playwright: real player flow through the browser, including a real LRCLIB call
/docs
  LEARNINGS.md
.github/workflows/ci.yml  # lint + typecheck + unit + e2e on push/PR; deploys on merge to main
.claude/launch.json       # `npm run dev:all` launch config used by the Claude Code preview tool
CLAUDE.md
```

Anti-cheat shape: the Worker is the only code that ever sees unmasked lyrics. Proximity scoring doesn't change that: the table lives server-side, and a guess comes back with numbers only — its score and the positions of the hidden words it is close to, never those words. `worker/src/songs.ts` resolves each song from the curated catalog (`catalog.ts`) via a live LRCLIB lookup (`lrclib.ts`, `lyrics.ts`), cached per song id with the Workers Cache API (`cache.ts`) rather than a database. Every response sends already-masked display tokens plus an opaque signed `state` string encoding the round's found words so far; the client just echoes it back on the next guess. This keeps the Worker stateless (no KV/D1 — the Cache API is a best-effort edge cache, not a source of truth) while making it impossible to forge "already found" words, since only the Worker holds the signing secret.

Dev wiring: `npm run dev:all` runs the Vite dev server and `wrangler dev` concurrently; `vite.config.ts` proxies `/api/*` to the Worker at `http://localhost:8787`, so the frontend always calls a relative `/api/...` URL in both dev and production (`VITE_API_BASE_URL` in `.env.example` only matters if the Worker is ever deployed to a different origin than the Pages site). `/scripts` runs through `tsx` (a devDependency) rather than Vite or Wrangler: it is plain Node tooling that imports both `src/game` and a few `worker/src` modules directly. `src/game` is not a published package — the root `tsconfig.json` and `worker/tsconfig.json` each `include` it directly by relative path, so it's type-checked and bundled independently by Vite and Wrangler straight from the same source files.

## Configuration

`STATE_SECRET` (the key the Worker signs round state with) is the only secret the app needs. Local dev reads it from `worker/.dev.vars`, production from `wrangler secret put STATE_SECRET`. It is deliberately **not** in `wrangler.toml`: Cloudflare rejects a `var` and a `secret` sharing one binding name (see `docs/LEARNINGS.md`).

Two standing rules, both learned the hard way — a missing `worker/.dev.vars` has broken CI once and a developer's machine once, and each time the only symptom was an opaque Web Crypto `DataError` about HMAC bit lengths:

- **A gitignored config file is never a manual setup step.** Script its creation and hang the script off the command that needs it (`predev:worker` runs `scripts/ensure-dev-vars.ts`). A step documented in the README is a step someone will skip, and CI — which only ever sees what is committed — skips it every time.
- **Missing configuration must name itself.** Anything read from `env` gets checked where it is read, with an error that says which variable is missing and how to set it in both dev and production. Never let it surface as a failure from whatever library happens to touch it three frames later.

## Deployment

- Frontend deploys to Cloudflare Pages, API to Cloudflare Workers, via Wrangler.
- GitHub Actions: run tests, then deploy on merge to `main`.

## graphify

This project can maintain a knowledge graph at `graphify-out/` (god nodes, community structure, cross-file relationships) via the `/graphify` skill. It has not been built yet — run `/graphify .` to generate it before relying on the rules below.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

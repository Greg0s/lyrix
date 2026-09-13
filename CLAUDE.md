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
- **Lyrics source**: LRCLIB (lrclib.net) — free, keyless API, queried server-side (`worker/src/lrclib.ts`, via `/api/search`, not `/api/get` — see `docs/LEARNINGS.md`) for whichever song `worker/src/catalog.ts` picks for the day. Resolved songs are cached per catalog id with the Workers Cache API (`worker/src/cache.ts`), so a given day triggers only a handful of LRCLIB calls rather than one per player. Optionally the Genius API for song search/autocomplete metadata only (Genius does not provide lyrics text itself) — not currently wired up.
- **Database**: none needed for the MVP. Cloudflare D1 is reserved for a later phase (accounts, leaderboard) — do not add it now. Cloudflare Workers KV holds the precomputed semantic-similarity tables (see "Semantic proximity scoring" below); it is a read-only lookup table built offline, not an application database.
- **Semantic proximity scoring**: French word embeddings (frWac2Vec), precomputed offline into a per-song word → score table. See the dedicated section below.
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
- **LRCLIB data isn't guaranteed clean**: handle missing lyrics, instrumental sections, and inconsistent formatting gracefully rather than assuming every response is well-formed.

## Semantic Proximity Scoring

Cemantix-style hinting: every guess that is *not* in the lyrics comes back with a 0-100 proximity score, so the player can tell "wrong, but you're circling it" from "wrong, and nowhere near".

**The scoring never happens at request time.** Embeddings are heavy and a Worker has milliseconds; instead, a table is precomputed offline per song and the Worker does one KV read plus one property lookup per guess. Do not add runtime inference (including Workers AI) to the guess path.

### Pipeline

1. **Model** — [frWac2Vec](https://fauconnier.github.io/#data) by Jean-Philippe Fauconnier, variant `frWac_no_postag_no_phrase_200_cut100` (200 dimensions, skip-gram, no POS tagging, frequency cutoff 100). No POS tagging means a word maps straight to a vector, with no tagging step before the lookup. It is **not** committed to this repo and not downloaded automatically — see "Model licensing" below.
2. **Convert** — `npm run similarity:convert` rewrites the model into the compact `.vecbin` format (`scripts/lib/embeddings.ts`): L2-normalized rows, one indexable vocabulary block, `--max-words` to drop the rare tail. Scoring is then a plain dot product.
3. **Build** — `npm run similarity:build` resolves a song's lyrics (LRCLIB, same path the Worker uses), tokenizes and normalizes them with `src/game/tokenize.ts` + `src/game/normalize.ts`, and scores every reference word by its **maximum** cosine similarity against any word of the song. Output: one `data/similarity/<songId>.json` per song, a few hundred kB each.
4. **Upload** — `wrangler kv bulk put` into the `SIMILARITY` namespace, keyed by song id.
5. **Serve** — `worker/src/similarity.ts` reads the table for the song in play and answers with a single number.

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

- **The score is the only thing that crosses the wire.** Never return the closest target word, a vector, a rank, or any slice of the table — only the score of the word the player typed. A guess that *is* in the lyrics scores 100 without a lookup, which leaks nothing the existing `found` flag didn't already.
- **The feature is optional at runtime.** With no `SIMILARITY` namespace bound, every score is `null` and the game behaves exactly as it did before scoring existed. Keep it that way: a missing table is never an error.
- **Reference vocabulary**: the model's vocabulary intersected with a common-word list (default: the model's own frequency order, capped at 50 000), proper nouns excluded, plus the song's own words forced in however rare they are.
- **Normalization must stay in step.** Table keys go through the same `normalize()` as a player's guess (lowercase, accents stripped), so one key can cover several model forms — the best-scoring one wins. Changing `normalize.ts` invalidates every stored table; rebuild them.
- **Local development uses placeholder scores.** `npm run dev:worker` passes `--var SIMILARITY_SAMPLE:1`, which serves the hand-written table in `worker/src/sampleSimilarity.ts` so the UI and the e2e suite work without the model or a KV namespace. That flag is never set in production, and a real KV table always wins over it.

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
    GameScreen.tsx  # top-level layout; wires useGame()/useIsMobile() into the rest
    TitleGuess.tsx  # masked title, victory banner ("come back tomorrow" note once solved)
    LyricsBody.tsx  # masked lyrics, grouped by section
    GuessForm.tsx   # word-guess input
    TriedWords.tsx  # past guesses: found vs. missed, proximity colour + score, sorted by score
    SideCard.tsx    # collapsible card shell, used for both side panels
    HowToPlay.tsx   # static rules text
  /hooks
    useGame.ts      # round/guess state machine; calls fetchRound/submitGuess, hydrates from
                    # roundStorage.ts before ever hitting the network, and persists after each change
    useIsMobile.ts  # 760px breakpoint match, drives SideCard collapse on mobile
  /game             # masking, matching, normalization — framework-agnostic, unit-tested,
                    # imported by BOTH the frontend (src) and the Worker (worker/src)
    types.ts        # Song (server-only) + the RoundView/GuessResult wire contract
    tokenize.ts     # splits text into word/non-word runs (keeps elisions like "l'amour" guessable)
    normalize.ts    # case/accent-insensitive key used for matching
    mask.ts         # builds masked DisplayToken views from a Song + found keys, checks victory
    similarity.ts   # the 0-100 proximity scale: cosine -> score, score -> colour tier, tried-word
                    # sorting. No embedding maths — that only ever runs offline, in /scripts
  /styles           # tokens.css (design tokens), global.css (reset/fonts), game.css
/worker
  /src
    index.ts      # Hono app: GET /api/round, POST /api/guess
    catalog.ts    # curated {id, artist, title} list + pickDailyEntry/catalogRotation — a
                   # deterministic day-of-epoch pick, so "today's song" needs no stored state
    lrclib.ts     # LRCLIB /api/search client: response parsing/validation + artist-match ranking
    lyrics.ts     # pure text parsing: plainLyricsFrom (prefers plainLyrics, falls back to
                  # syncedLyrics with timestamps stripped) and parseSections (paragraphs -> Section[])
    cache.ts      # Workers Cache API wrapper (getCachedSong/putCachedSong); no-ops outside the
                  # real Workers runtime so callers stay testable under plain-Node Vitest
    resolveSong.ts # one catalog entry -> a playable Song via LRCLIB. Split out of songs.ts so it
                  # stays free of Workers-only globals: the offline table builder reuses it under Node
    songs.ts      # secret lyrics data — never imported from /src. getSongById resolves one
                  # catalog id (cache -> LRCLIB -> parse); getTodaysSong adds the daily pick,
                  # a fallback chain across the catalog, and a hardcoded emergency song for a
                  # total LRCLIB outage
    similarity.ts # reads the precomputed word -> score table for a song from Workers KV and
                  # answers one lookup per guess; degrades to "no score" when unbound or broken
    sampleSimilarity.ts # hand-written placeholder scores for dev/e2e, gated on SIMILARITY_SAMPLE
    state.ts      # HMAC-signed round state (songId + foundKeys) via Web Crypto, so the
                  # stateless Worker can't be tricked into trusting client-forged progress
  wrangler.toml   # Worker config; STATE_SECRET dev default lives here, prod uses `wrangler secret put`;
                  # also holds the commented-out SIMILARITY KV binding and how to enable it
  tsconfig.json   # Worker's own compiler options (Workers lib/types), separate from the root tsconfig
/scripts          # offline tooling, run by hand with tsx — never bundled into the Worker
  convert-embeddings.ts      # word2vec (text or binary) -> the compact .vecbin format
  build-similarity-table.ts  # song(s) + model -> data/similarity/<songId>.json, ready for KV
  /lib
    embeddings.ts      # word2vec/compact readers + writers, L2 normalization, dot product
    vocabulary.ts      # normalized key index, proper-noun filtering, reference-word selection
    similarityTable.ts # pure scoring: reference word -> max cosine against the song's words
/tests
  /unit/game    # Vitest: tokenize/normalize/mask/similarity
  /unit/worker  # Vitest: catalog rotation, LRCLIB parsing, lyrics parsing, Hono routes
                # (exercised via app.request() against a mocked fetch), state signing,
                # similarity-table lookup against a fake KV namespace
  /unit/scripts # Vitest: the offline pipeline, against a 3-dimension fixture model (no real model in CI)
  /unit/storage # Vitest: roundStorage save/load against a fake Storage
  /e2e          # Playwright: real player flow through the browser, including a real LRCLIB call
/docs
  LEARNINGS.md
.github/workflows/ci.yml  # lint + typecheck + unit + e2e on push/PR; deploys on merge to main
.claude/launch.json       # `npm run dev:all` launch config used by the Claude Code preview tool
CLAUDE.md
```

Anti-cheat shape: the Worker is the only code that ever sees unmasked lyrics. Proximity scoring doesn't change that: the table lives server-side and a guess comes back with one number, never the word it was close to. `worker/src/songs.ts` resolves each song from the curated catalog (`catalog.ts`) via a live LRCLIB lookup (`lrclib.ts`, `lyrics.ts`), cached per song id with the Workers Cache API (`cache.ts`) rather than a database. Every response sends already-masked display tokens plus an opaque signed `state` string encoding the round's found words so far; the client just echoes it back on the next guess. This keeps the Worker stateless (no KV/D1 — the Cache API is a best-effort edge cache, not a source of truth) while making it impossible to forge "already found" words, since only the Worker holds the signing secret.

Dev wiring: `npm run dev:all` runs the Vite dev server and `wrangler dev` concurrently; `vite.config.ts` proxies `/api/*` to the Worker at `http://localhost:8787`, so the frontend always calls a relative `/api/...` URL in both dev and production (`VITE_API_BASE_URL` in `.env.example` only matters if the Worker is ever deployed to a different origin than the Pages site). `/scripts` runs through `tsx` (a devDependency) rather than Vite or Wrangler: it is plain Node tooling that imports both `src/game` and a few `worker/src` modules directly. `src/game` is not a published package — the root `tsconfig.json` and `worker/tsconfig.json` each `include` it directly by relative path, so it's type-checked and bundled independently by Vite and Wrangler straight from the same source files.

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

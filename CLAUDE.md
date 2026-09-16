# CLAUDE.md

This file gives Claude Code the context and rules needed to work on this project. Keep it in English and keep it up to date — see "Continuous Improvement Loop" below.

## Project Overview

A free web game inspired by Pedantix, built around song lyrics instead of Wikipedia articles. The player types words to progressively reveal a song's lyrics; the round is won once the title is fully uncovered.

- One song per day: every player gets the same puzzle (Motus/Wordle-style), rotating at UTC midnight from a curated catalog (`worker/src/catalog.ts`). There is no "replay with a different song" — once solved, the player waits for tomorrow's song.
- Target audience: French-speaking, tech-savvy web users.
- No user accounts or personal data in the MVP.
- Project name: **Lyrix**.

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
- **Component tests**: Vitest with jsdom + `@testing-library/react` (`tests/unit/components`), for what a
  React change does to the player's experience — above all how much of the page a keystroke re-renders.
  Assert on counted work (renders, reads, writes), never on timings, which would be flaky.
- **End-to-end tests**: Playwright, for the actual player flow (load game, type a guess, see it revealed, win the round). Assert against the DOM/game state, not visual/pixel output.
- **E2E runs against its own servers**: `npm run test:e2e` starts a fresh Vite dev server on port 15173 and Worker on 18787 (inspector 19229) — Vite's `/api` proxy follows it there through `API_PROXY_TARGET` — plus a second Worker on 18788 (inspector 19230) serving a fixture table out of a local KV namespace, started by the very command a developer plays with (`npm run dev:similarity`). Each Worker gets its own `--persist-to` state directory, so a table loaded for local play can never turn up under the suite's placeholder assertions. It never reuses a server that is already running, so it always tests this checkout's code while `npm run dev:all` (5173/8787) stays up here or in any other clone or worktree. Keep it that way: Playwright's readiness check only proves that *something* answers on a port, not which checkout started it. If a run stops with "… is already used", stop whatever holds the port instead of turning `reuseExistingServer` back on. Guarded by `tests/unit/ci/e2e-servers.test.ts`.
- **Before marking a task done**: run the relevant test script(s) yourself (`npm test`, `npm run test:e2e`) and report the result. If verifying the task requires a check that isn't yet scripted, write that script first, then run it — don't verify by hand and move on.
- **Every bug fix** must add a regression test that would have caught it, in the same commit as the fix.
- **CI**: GitHub Actions runs the full test suite on every push/PR, before deployment.

## Performance

The game's own logic is cheap; everything that has ever been slow here was correct work being
repeated for a value that had not changed. Two standing rules, and a habit:

- **Nothing in the Worker's per-guess path may scale with the length of the song.** A song is
  immutable once resolved, so anything derived from it is derived once and memoized — the
  tokenization pass (`src/game/analyze.ts`), the resolved song itself, the parsed similarity table,
  the HMAC key. When you add an isolate-level cache, add its `reset*()` and call it from the
  affected tests' `beforeEach` in the same commit: until you do, a test that means to count real
  work is quietly answered by the previous test's cache.
- **Typing a guess must not re-render the lyrics.** They are the biggest thing on the page and have
  nothing to do with the word being typed. Derived state goes through `useMemo` keyed on what it
  actually reads (the round, the tried words), and the components that display it are `memo()`d.
- **Measure before and after, and pin the result with a test that counts the work** — how many times
  a song is tokenized, how many KV reads one round costs, how many tokens React renders for one
  keystroke. None of this class of bug fails a test or looks wrong in a diff, so an unpinned fix
  comes straight back. Never assert on elapsed time.

## Continuous Improvement Loop

Keep a `docs/LEARNINGS.md` file (create it if it doesn't exist) as a running log of things worth remembering across sessions:

1. **When you hit a gotcha** (an LRCLIB quirk, a French-text-matching edge case, a Wrangler/Cloudflare deployment detail, anything that cost real time to figure out), append a short, dated entry to `docs/LEARNINGS.md` explaining what happened and how it was resolved.
2. **When you fix a bug**, note the root cause there too, alongside the regression test added for it.
3. **Periodically** (or when asked to "review learnings"), re-read `docs/LEARNINGS.md`: if the same category of mistake shows up more than once, turn it into an explicit rule in this file (CLAUDE.md) instead of leaving it as a log entry — the log is for one-off notes, this file is for standing rules.
4. Treat this loop as making the fix permanent, not as a substitute for actually fixing the root cause first.

## Domain-Specific Rules

- **Anti-cheat is a hard requirement**, even in the MVP: the Worker is the only thing that knows the actual lyrics. It receives a guessed word and returns which positions match — it never returns, and the client never receives, the full text before the round is won. The one narrow exception is the `DEV_REVEAL_LYRICS` Worker flag (`worker/src/index.ts`): when set, `buildTitleView`/`buildSectionsView` (`src/game/mask.ts`) attach every still-hidden word's real text to the round view as `DisplayToken.devHint`, so the frontend (`WordToken.tsx`) can show it at low opacity for local debugging of the game and the close-word mechanic — a found word or a close guess still always takes priority over it. Wired into the `dev:worker` npm script exactly like `SIMILARITY_SAMPLE` (so `npm run dev:all` and `npm run test:e2e` both carry it), never present in `wrangler.toml` or a production secret, so a production response is unaffected.
- **French text matching**: normalize both the guess and the stored lyrics before comparing (case-insensitive, accent-insensitive, with the œ and æ ligatures spelled out) and account for French elisions ("j'aime" vs "je aime", "qu'il", "l'amour") so a correct guess isn't missed due to punctuation attached to the word. The tokenizer's letters (`LETTER_CLASS` in `src/game/tokenize.ts`) must cover every letter French lyrics use: it once stopped at Latin-1, and "cœur" could never be found. A run of digits is a word too, hidden and guessed like any other.
- **LRCLIB data isn't guaranteed clean**: handle missing lyrics, instrumental sections, and inconsistent formatting gracefully rather than assuming every response is well-formed.

## Semantic Proximity Scoring

Cemantix-style hinting: every guess that is *not* in the lyrics comes back with a 0-100 proximity score, so the player can tell "wrong, but you're circling it" from "wrong, and nowhere near". Pedantix-style on top of that: a guess that is close to hidden words is shown in their place in the lyrics (and the title), shaded by how close it is, until a closer guess — or the word itself — takes the slot back.

**A score is a rank, not a cosine.** For each hidden word, the 50,000 most frequent words are ranked by closeness, and a guess scores `100 − 20·log10(rank)` (`scoreFromRank` in `src/game/similarity.ts`): 80 as one of the hidden word's 10 nearest neighbours, 60 in its top 100, 40 in its top 1000. A guess's overall score is its best against any word of the song.

**The scoring never happens at request time.** Embeddings are heavy and a Worker has milliseconds; instead, a table is precomputed offline per song and the Worker does one KV read plus a couple of property lookups per guess. Do not add runtime inference (including Workers AI) to the guess path. The one exception is numbers, which the model has no vector for: a guessed number is compared by value with the song's own numbers (`numberProximityScore`), plain arithmetic over a list worked out once per song.

### Pipeline

1. **Model** — [frWac2Vec](https://fauconnier.github.io/#data) by Jean-Philippe Fauconnier, file `frWac_non_lem_no_postag_no_phrase_200_skip_cut100.bin` (120 MB: 200 dimensions, skip-gram, not lemmatized, no POS tagging, frequency cutoff 100). Not lemmatized matters: a lemmatized model has no "eaux" and no conjugated verbs, which lyrics are full of. The model is lowercased, keeps accents, spells "coeur", and has no digit tokens at all. It is **not** committed to this repo and not downloaded automatically — see "Model licensing" below.
2. **Convert** — `npm run similarity:convert` rewrites the model into the compact `.vecbin` format (`scripts/lib/embeddings.ts`): L2-normalized rows, one indexable vocabulary block, `--max-words` to drop the rare tail. Scoring is then a plain dot product. Optional: the build reads the `.bin` directly too.
3. **Build** — `npm run similarity:build` resolves a song's lyrics (LRCLIB, same path the Worker uses) and tokenizes and normalizes them with `src/game/tokenize.ts` + `src/game/normalize.ts`. For every song word worth pointing at — not a function word, not a number, known to the model — it ranks the `RANK_VOCABULARY_SIZE` (50,000) most frequent reference words by cosine, and scores every reference word against that song word from where it falls (`scripts/lib/similarityTable.ts`). A word's `scores` entry is its best score against any song word; `near` keeps the song words it scores at least `NEAR_SCORE` against, closest first, at most `MAX_NEAR_TARGETS` (16), as `[targetIndex, score, …]` pairs into `targets`. A pair under `MIN_NEAR_COSINE` (0.2) is never placed, whatever its rank. Output: one `data/similarity/<songId>.json` per song. The build log prints each table's size (about 1.3 MB for a song): the Worker parses a whole table once per isolate, so watch it when tuning `MAX_NEAR_TARGETS` or `NEAR_SCORE`.
4. **Check** — `npm run similarity:inspect -- --song <id> <guess…>` prints what a built table answers for a few guesses: each one's score and the song words it would be shown on. It is how to judge a table, or a change to the scoring, against real data.
5. **Upload** — `wrangler kv bulk put` into the `SIMILARITY` namespace, keyed by song id.
6. **Serve** — `worker/src/similarity.ts` reads the table for the song in play and answers with the guess's score plus `near`: the positions of the still-hidden words it is close to, each with its own score. A guessed number is answered from the song's numbers instead. The frontend then shows every hidden word's closest guess so far in its place (`src/game/slots.ts`), shaded along a cold-to-hot colour ramp (`proximityHeat`).

### Commands

```bash
# one-off: compact the downloaded model
npm run similarity:convert -- --input data/models/frWac_non_lem_no_postag_no_phrase_200_skip_cut100.bin \
                              --output data/models/frwac.vecbin --max-words 200000

# whenever a song joins the catalog (or for the whole catalog)
npm run similarity:build -- --model data/models/frwac.vecbin --song papaoutai
npm run similarity:build -- --model data/models/frwac.vecbin --all --bulk

# what a built table answers, hidden words included
npm run similarity:inspect -- --song papaoutai amour papa

# upload (after creating the namespace, see worker/wrangler.toml)
npx wrangler kv bulk put data/similarity/bulk.json --binding SIMILARITY --remote --config worker/wrangler.toml

# play today's song against a real table, here: builds it, loads it into a KV
# namespace that exists only on this machine, starts Vite and the Worker on it
npm run dev:similarity
```

`npm run similarity:build -- --help` lists the rest (`--vocabulary` for a Lexique383-style common-word list, `--max-vocabulary`, `--lyrics` to build from a local file without calling LRCLIB), and `npm run dev:similarity -- --help` its own (`--model`, `--table` to play a table already built, `--reveal` to show the hidden words faintly).
`npm run similarity:build -- --help` lists the rest (`--vocabulary` for a Lexique383-style common-word list, most frequent first, `--max-vocabulary`, `--lyrics` to build from a local file without calling LRCLIB).

### Rules

- **Only numbers cross the wire.** A missed guess gets its own score, plus the positions of the hidden words it is close to with a score each — never the text of the word at a position, a vector, a rank, or any slice of the table beyond the typed word's own entry. A guess that *is* in the lyrics scores 100 without a lookup and is placed nowhere, which leaks nothing the existing `found` flag didn't already.
- **Hidden words are addressed by position, never by an id.** `src/game/slots.ts` counts every word of the round, the title's first, then the lyrics' in reading order. `wordPositions` (Worker side) and `placeNearGuesses` (frontend side) must keep counting the same way, and a unit test runs them against each other. Don't stamp an id on every masked token instead: it would tell the player which blanks hide the same word before they have come close to any of them.
- **Placement is display, not progress.** Which guess sits on which hidden word is derived on the client from the tried-word list — the closest guess wins, a tie keeps the earlier one, a revealed word always shows itself — and saved with that list by `roundStorage.ts`. It never enters the signed round state: a forged placement only fools the player who forged it.
- **`NEAR_SCORE` is pegged to the warm tier**, so a guess whose chip is warm or hot always lands somewhere, unless everything it is close to is already revealed. The build drops pairs below it, so lowering it means rebuilding the tables; the Worker checks it again on every read, so raising it doesn't. Any change to the table's shape bumps `SIMILARITY_TABLE_VERSION` (currently 2): older tables are then ignored rather than half-read, and have to be rebuilt.
- **The feature is optional at runtime.** With no `SIMILARITY` namespace bound, every score is `null`, nothing is placed, and the game behaves exactly as it did before scoring existed. Keep it that way: a missing table is never an error.
- **Reference vocabulary**: the model's vocabulary intersected with a common-word list (default: the model's own frequency order, capped at 50 000), proper nouns excluded, plus the song's own words forced in however rare they are.
- **Normalization must stay in step.** Table keys go through the same `normalize()` as a player's guess (lowercase, accents stripped), so one key can cover several model forms — the best-scoring one wins. Changing `normalize.ts` invalidates every stored table; rebuild them.
- **Local development uses placeholder scores, and one command swaps them for real ones.** `npm run dev:worker` passes `--var SIMILARITY_SAMPLE:1`, which serves the hand-written table in `worker/src/sampleSimilarity.ts` so the UI and the e2e suite work without the model or a KV namespace. That flag is never set in production, and a real KV table always wins over it. The table only covers a few dozen words, so the Worker prints the whole list to its log the first time it serves one — keep it that way, or the only way to test the feature is to read the source. Its placements are arbitrary but stable: each sample word scoring `NEAR_SCORE` or more lands on one or two words of the day's song, picked by hashing it — so e2e tests assert on *how* a close word shows up, never on *where*. `npm run dev:similarity` (`scripts/dev-similarity.ts`) is the other half: it builds the day's table, loads it with `wrangler kv bulk put --local` into the namespace bound by `worker/wrangler.similarity.toml`, and plays against it — deliberately *without* `SIMILARITY_SAMPLE`, so a table that failed to load reads as no scores rather than as placeholder ones. Whatever the loader and the Worker have to agree on (configuration, binding, state directory) lives in `scripts/lib/localSimilarity.ts`: they are two separate wrangler runs, and a table written where the Worker doesn't look is silent.
- **A bound namespace with nothing usable in it says so.** Every guess coming back unscored looks exactly like a Worker with the feature switched off, so `worker/src/similarity.ts` logs which it is — once per song per isolate — when the namespace holds no table for the song in play, or one from an older format. A stale table is never quietly replaced by the placeholder: a wrong score is worse than none.
- **The deployed Worker never gains a local-only binding.** The deploy job passes `worker/wrangler.toml`, which binds no namespace at all; the local binding lives in `worker/wrangler.similarity.toml`, which nothing deploys — so a made-up namespace id can't fail a deploy, and an `[env.…]` section can't have wrangler warn on every one. The two files are otherwise identical, and `tests/unit/ci/localSimilarity.test.ts` fails on any other difference: a Worker played locally under a different compatibility date is not the Worker being shipped. `npm run deploy:check` builds the deployed configuration on every CI run, so a broken one is caught before a merge rather than after.
- **Ranks, not cosines.** A fixed cosine cut-off means something different for every hidden word (a word's 1000th neighbour sits anywhere between 0.29 and 0.46 in frWac2Vec), so it is always too loose for some and too strict for others. Scores come from ranks, counted among a fixed number of the most frequent words (`RANK_VOCABULARY_SIZE`), so `--max-vocabulary` changes which guesses get a score, never what a score means. Don't bring back a cosine threshold beyond the `MIN_NEAR_COSINE` safety floor.
- **`NEAR_SCORE` is pegged to the warm tier** (40: a hidden word's 1000 nearest neighbours), so a guess whose chip is warm or hot always lands somewhere, unless everything it is close to is already revealed. The build drops pairs below it, so lowering it means rebuilding the tables; the Worker checks it again on every read, so raising it doesn't. Any change to the table's shape, or to what its scores mean, bumps `SIMILARITY_TABLE_VERSION` (currently 3): older tables are then ignored rather than half-read, and have to be rebuilt.
- **Function words never count.** Articles, pronouns, prepositions, conjunctions, être and avoir, and interjections (`src/game/functionWords.ts`) sit close to nearly every word in an embedding model; left in, they took the placements of most guesses. The build never points at them and gives them no score; guessing one still reveals it. Keep the list short of adverbs that mean something in a song ("toujours", "jamais", "rien") and of homographs whose other reading is a real word ("ete", summer).
- **Numbers are compared by value.** `tokenize()` makes a word of a run of digits, so numbers are hidden like any word, but the model has no vector for one: `numberHint` (`worker/src/similarity.ts`) scores a guessed number against the song's numbers with `numberProximityScore`, where a 10% gap sits right on `NEAR_SCORE`, and only when a table, real or sample, is available.
- **The feature is optional at runtime.** With no `SIMILARITY` namespace bound, every score is `null` (numbers included), nothing is placed, and the game behaves exactly as it did before scoring existed. Keep it that way: a missing table is never an error.
- **Reference vocabulary**: the model's vocabulary intersected with a common-word list (default: the model's own frequency order, capped at 50 000), proper nouns included ("france" is a fine hint for "allemagne"), function words and digits left out, plus the song's own words forced in however rare they are.
- **Normalization must stay in step.** Table keys go through the same `normalize()` as a player's guess (lowercase, accents stripped, œ and æ spelled out), so one key can cover several model forms — the best-scoring one wins. Changing `normalize.ts`, or the letters `tokenize.ts` accepts, invalidates every stored table; rebuild them.
- **Calibrate against the real model, never against the placeholder.** Everything seen in dev comes from the sample table below, and it once hid that no real table had ever been built (see `docs/LEARNINGS.md`, 2026-09-15). Before tuning a threshold, build a table with the model and read it with `similarity:inspect`.
- **Local development uses placeholder scores.** `npm run dev:worker` passes `--var SIMILARITY_SAMPLE:1`, which serves the hand-written table in `worker/src/sampleSimilarity.ts` so the UI and the e2e suite work without the model or a KV namespace. That flag is never set in production, and a real KV table always wins over it. The table only covers a few dozen words, so the Worker prints the whole list to its log the first time it serves one — keep it that way, or the only way to test the feature is to read the source. Its placements are arbitrary but stable: each sample word scoring `NEAR_SCORE` or more lands on up to four words of the day's song that aren't function words, picked by hashing it, eight points lower each time — so e2e tests assert on *how* a close word shows up, never on *where*.

### Model licensing

frWac2Vec is published by its author under **CC BY 3.0** ([fauconnier.github.io](https://fauconnier.github.io/#data)): free to copy, redistribute and adapt for any purpose, with attribution. Deriving tables from it and uploading them to KV is therefore allowed, on the one condition the code already meets: the game credits the model (name, author, licence, link) under the tried-word list whenever a score is shown (`TriedWords.tsx`, checked by the e2e suite). Keep that credit if the display changes, and change it if the model is swapped.

Still true either way:

- the model is **not** committed, **not** vendored, and **never** downloaded automatically — someone has to fetch it by hand;
- `data/models/` and `data/similarity/` are gitignored, so neither the model nor tables derived from it enter git;
- only derived numbers (word → score) ever reach Cloudflare KV, never the vectors themselves.

A word list passed with `--vocabulary` (e.g. Lexique383) comes with its own licence, which nobody has checked: check it before building production tables with one.

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
                    # so a page reload resumes progress instead of restarting the daily song.
                    # saveRoundSoon defers the write to an idle callback (newest wins) and
                    # flushSavedRound forces it out when the tab is hidden or closed
  /api
    client.ts       # fetch wrapper the frontend uses to call the Worker (fetchRound, submitGuess)
  /components       # presentational React components
    GameScreen.tsx  # top-level layout; wires useGame()/useIsMobile() into the rest, and lays each
                    # hidden word's closest guess onto the round (slots.ts) before rendering it
    TitleGuess.tsx  # masked title, victory banner ("come back tomorrow" note once solved)
    LyricsBody.tsx  # masked lyrics, grouped by section
    WordToken.tsx   # one title/lyrics token: punctuation, found word, blank, blank holding a close guess
                    # (shaded by its score), or (dev-only) blank showing its real text at low opacity
    heatStyle.ts    # the inline --heat a scored word is shaded with, along game.css's cold-to-hot ramp
    GuessForm.tsx   # word-guess input
    TriedWords.tsx  # past guesses: found vs. missed, proximity shade + score, sorted by score; credits
                    # the embedding model (CC BY 3.0) whenever anything is scored
    SideCard.tsx    # collapsible card shell, used for both side panels
    HowToPlay.tsx   # static rules text
  /hooks
    useGame.ts      # round/guess state machine; calls fetchRound/submitGuess, hydrates from
                    # roundStorage.ts before ever hitting the network, and persists after each change.
                    # Each tried word keeps its score and the hidden positions it is close to
    useIsMobile.ts  # 760px breakpoint, as a matchMedia subscription (fires only when it is crossed),
                    # drives SideCard collapse on mobile
  /game             # masking, matching, normalization — framework-agnostic, unit-tested,
                    # imported by BOTH the frontend (src) and the Worker (worker/src)
    types.ts        # Song (server-only) + the RoundView/GuessResult wire contract, NearSlot included
    tokenize.ts     # splits text into word/non-word runs (keeps elisions like "l'amour" guessable; a run
                    # of digits is a word too). LETTER_CLASS is shared with the offline vocabulary
    normalize.ts    # case/accent-insensitive key used for matching, œ and æ spelled out
    analyze.ts      # one tokenize+normalize pass per song (tokens, their keys, their blanks, word keys,
                    # word positions, number keys), memoized against the Song object. mask.ts and slots.ts
                    # read it instead of walking the song themselves - see "Performance" below
    mask.ts         # builds masked DisplayToken views from a Song + found keys, checks victory; optionally
                    # attaches each hidden word's real text as devHint (DEV_REVEAL_LYRICS, dev-only)
    similarity.ts   # the 0-100 proximity scale: rank -> score, number closeness, score -> colour tier and
                    # shade, tried-word sorting, NEAR_SCORE. No embedding maths — that only ever runs
                    # offline, in /scripts
    functionWords.ts # French function words, never pointed at nor scored by the similarity tables (read by
                    # the offline build and the sample table, never by the frontend)
    slots.ts        # addressing hidden words by position: wordPositions (Worker side), the closest
                    # guess per hidden word, and placeNearGuesses (frontend side)
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
                  # catalog id (isolate memo -> cache -> LRCLIB -> parse; resetSongMemo for tests),
                  # getTodaysSong adds the daily pick,
                  # a fallback chain across the catalog, and a hardcoded emergency song for a
                  # total LRCLIB outage
    similarity.ts # reads the precomputed table for a song from Workers KV and answers each guess
                  # with its score plus the positions of the hidden words it is close to (a guessed
                  # number is compared with the song's numbers instead); degrades to "no score, no
                  # placement" when unbound or broken. The parsed table is memoized per isolate
                  # (resetSimilarityMemo for tests) - parsing it per guess was the most expensive
                  # thing in the request path
    sampleSimilarity.ts # hand-written placeholder scores (and hash-picked placements, a few per word)
                  # for dev/e2e, gated on SIMILARITY_SAMPLE
    state.ts      # HMAC-signed round state (songId + foundKeys) via Web Crypto, so the
                  # stateless Worker can't be tricked into trusting client-forged progress
  wrangler.toml   # Worker config; STATE_SECRET dev default lives here, prod uses `wrangler secret put`;
                  # also holds the commented-out SIMILARITY KV binding and how to enable it
  wrangler.similarity.toml # the same Worker plus a SIMILARITY namespace that exists only on this
                  # machine, for `npm run dev:similarity`. `wrangler deploy` never reads it, and a
                  # unit test fails on any difference from wrangler.toml other than that binding
  tsconfig.json   # Worker's own compiler options (Workers lib/types), separate from the root tsconfig
/scripts          # Node tooling run through tsx — never bundled into the Worker
  ensure-dev-vars.ts         # creates worker/.dev.vars from its example; npm's predev:worker hook
  convert-embeddings.ts      # word2vec (text or binary) -> the compact .vecbin format
  build-similarity-table.ts  # song(s) + model -> data/similarity/<songId>.json, ready for KV
  dev-similarity.ts          # one command to play today's song on a real table: build it, load it
                             # into the local-only KV namespace, start Vite and the Worker on it
  inspect-similarity-table.ts # what a built table answers for a few guesses: scores and song words
  /lib
    devVars.ts         # copy-if-absent helper behind ensure-dev-vars.ts
    localSimilarity.ts # what the loader and the Worker must agree on (configuration, binding,
                       # state directory), plus model discovery and table validation
    embeddings.ts      # word2vec/compact readers + writers, L2 normalization, dot product
    vocabulary.ts      # normalized key index and reference-word selection
    similarityTable.ts # pure scoring: each song word's neighbours ranked, every reference word scored
                       # from its rank, plus the song words it is close to
/tests
  /unit/game    # Vitest: tokenize/normalize/mask/similarity/slots/function words
  /unit/worker  # Vitest: catalog rotation, LRCLIB parsing, lyrics parsing, Hono routes
                # (exercised via app.request() against a mocked fetch), state signing,
                # similarity-table lookup against a fake KV namespace
  /unit/scripts # Vitest: the offline pipeline, against hand-written fixture models (no real model in CI)
  /unit/storage # Vitest: roundStorage save/load against a fake Storage, deferred writes under fake timers
  /unit/components # Vitest + jsdom + @testing-library/react: what the player feels between keystrokes —
                # counts how many lyrics tokens React re-renders, and the round's storage round trip
  /unit/ci      # Vitest: tooling config — deploy-job env and dry run, e2e server ports/reuse/proxy
                # and state-directory wiring, the two wrangler configurations against each other,
                # how the web fonts are loaded
  /e2e          # Playwright: real player flow through the browser, including a real LRCLIB call.
                # fixtures/similarity-table.json stands in for a built table, since no CI machine
                # has the model: localSimilarity.spec.ts plays a Worker against it
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

The local KV binding follows both rules: `worker/wrangler.similarity.toml` is committed rather than left to a `wrangler kv namespace create` someone has to remember, `npm run dev:similarity` creates `worker/.dev.vars` itself (it starts wrangler without going through the `predev:worker` hook), and it stops with the directories it searched named when there is no embedding model to build today's table from.

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

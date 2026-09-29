# CLAUDE.md

This file gives Claude Code the context and rules needed to work on this project. Keep it in English and keep it up to date — see "Continuous Improvement Loop" below.

## Project Overview

A free web game inspired by Pedantix, built around song lyrics instead of Wikipedia articles. The player types words to progressively reveal a song's lyrics; the round is won once the title is fully uncovered.

- One song per day, same puzzle for everyone (Motus/Wordle-style), rotating at UTC midnight from a curated catalog (`worker/src/catalog.ts`). No "replay with a different song" — once solved, the player waits for tomorrow's.
- Target audience: French-speaking, tech-savvy web users. No user accounts or personal data in the MVP.
- Project name: **Lyrix**.

## Current Phase: MVP (no 3D)

The UI follows the "Lyrix v3" mockup, in a light and a dark theme: sticky header, one song card whose hidden words are accent bars, a sticky guess dock, and a side column (progress, tried words). Short CSS animations only, all disabled under `prefers-reduced-motion` — no 3D. Do not add 3D dependencies (`three`, `@react-three/fiber`, `@react-three/drei`) unless explicitly asked; 3D is a planned post-MVP phase (see "Out of Scope"). MVP scope: masked lyrics (blanks matching word length, punctuation/line breaks preserved), a text input that reveals every occurrence of a correctly guessed word, and a win state once the title is fully uncovered.

## Tech Stack

- **Frontend**: Vite + React, TypeScript strict mode.
- **Backend**: Cloudflare Workers + Hono. Keeps the target lyrics secret server-side — never expose the full lyrics text to the client, even hidden or obfuscated in the bundle or a response.
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Workers (API).
- **Lyrics source**: LRCLIB (lrclib.net), queried server-side via `/api/search` (not `/api/get` — see `docs/LEARNINGS.md`), cleaned before it is ever masked (`worker/src/lyrics.ts`), cached per catalog id with the Workers Cache API (`worker/src/cache.ts`).
- **Database**: none. Cloudflare D1 is reserved for a later phase (accounts, leaderboard) — do not add it now. Workers KV holds only the precomputed similarity tables (see below), not application data.
- **Rooms** ("salons", #29): one SQLite-backed Durable Object per room code (`worker/src/room.ts`), members kept live over hibernatable WebSockets, everything deleted at the next UTC midnight. Creating and joining are rate-limited per client with the Workers Rate Limiting binding (`worker/src/roomRoutes.ts`). Each room also plays the day's round together (#30): its object holds the room's guesses and sends every member the same masked view.
- **Semantic proximity scoring**: French word embeddings, precomputed offline into a per-song score table — see `docs/SIMILARITY.md`.
- **Planned, not yet in scope**: `@react-three/fiber`/`@react-three/drei` for in-game 3D; word-usage counter.

## Working on this project

- Install: `npm install`
- Run: `npm run dev:all` (Vite + `wrangler dev` side by side; `/api/*` is proxied to the Worker)
- Test: `npm test` (lint + typecheck + Vitest), `npm run test:e2e` (Playwright)
- Debug mode — play against real proximity scores instead of the dev placeholder: `npm run dev:debug`
- Knowledge graph refresh after code changes: `npm run graph:update` (see "graphify" below)
- There is no Prettier config or dependency: never run `npx prettier --write` here — its defaults reformat every file it touches. Match the surrounding style by hand.
- In a cloud session, the pre-installed Chromium is not the build the pinned `@playwright/test` expects, so every e2e test fails at launch ("Executable doesn't exist"). Run the suite through a throwaway, uncommitted config that re-exports `playwright.config.ts` with `use.launchOptions.executablePath: "/opt/pw-browsers/chromium"`. LRCLIB is unreachable there too, so specs that look the day's song up in `catalog` fail on the emergency song — compare against `main` before blaming a change.

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
- **Typing a guess must not re-render the lyrics.** Derived state goes through `useMemo` keyed on what it actually reads; components that display it are `memo()`d. Neither may opening a dialog, tapping a bar (its "N lettres" tip is local state in `WordToken`'s `Blank`), or moving between bars with the arrow keys (the roving tab stop lives in the DOM — `useRovingBlanks`).
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
- **Theming**: light and dark palettes, both in `src/styles/tokens.css` (dark under `:root[data-theme="dark"]`). Components use tokens only, never a raw colour, and a text token is never a surface: dark fills use `--color-solid*` and stay dark in both themes (text on them is `--color-on-ink*`), bright fills take `--color-on-bright` text. The theme follows the system until the player picks one with the header's toggle (`src/theme.ts`, stored in localStorage); `index.html`'s inline script applies it before first paint and must stay in step with `initialTheme()` (`tests/unit/theme.test.ts`).
- **Rooms** (#29): a room knows its code, its members, and its round. Its wire contract, codes (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 6 characters) and pseudo sanitizing live in `src/game/room.ts`, shared by both sides. Two rules keep codes from being enumerated: every join attempt is rate-limited, and no other route may answer differently for a live code than for a dead one (an unknown token and an unknown room close the socket the same way, and get the same 404 from `/guess`; leave always answers 204). A pseudo is personal data: stored only in its room's Durable Object, deleted with the room, never logged.
- **A room's round lives in its Durable Object** (#30), never on a client: a member sends a word (`POST /api/rooms/:code/guess`), the object checks it with the same code as the solo route (`worker/src/round.ts`), keeps it, and sends every member the room's masked view plus its guess list — over the socket on (re)connection and after each guess. The song is pinned the first time the room needs it. Victory, and with it `revealHint`, is the room's, but only the member who completed the title (`RoomRound.winningKey`) sees it straight away: everyone else keeps looking alone, on a solo round the room signs for them (`POST /api/rooms/:code/alone`: the group's finds but the winning word, plus their own verified solo state), until they win it or press "Afficher la réponse" (remembered per room, `roomStorage`). While they look alone, the room's later finds are never announced to them. A teammate's close guesses are placed in everyone's lyrics. While in a room, the solo round (`roundStorage`) is set aside untouched and comes back on leaving; the room's round is never saved locally. An answer and a broadcast can cross: a view only replaces one with fewer guesses.
- **LRCLIB data isn't guaranteed clean**: `plainLyrics`/`syncedLyrics` are LRC-format text, not prose. Everything unsung is dropped before masking (`cleanLyrics`) — a player must never be asked to guess `[Refrain]`, `♪`, or the artist out of an `[ar:…]` tag — and a result too thin to be a puzzle is refused (`MIN_LYRIC_WORDS`) so the day's pick falls through to the next catalog entry. The catalog is only as good as LRCLIB's copy of it and the suite mocks the network on purpose, so run `npm run catalog:check` after editing `worker/src/catalog.ts`, and whenever a day's round looks wrong.

## Semantic Proximity Scoring

Cemantix-style hinting: a guess that isn't in the lyrics comes back with a 0-100 proximity score, and one close enough to a hidden word is shown in its place, shaded by closeness, until a closer guess or the word itself takes the slot back. The table is precomputed **offline** per song (`npm run similarity:build`); the guess-time path is one KV read plus a couple of lookups — never add runtime inference (including Workers AI) to it. **Only numbers ever cross the wire**: a missed guess's score plus the positions of hidden words it's close to, never their text. With no `SIMILARITY` namespace bound, every score is `null` and the game behaves exactly as before scoring existed — that must stay true.

Full pipeline, commands, scoring rules and model licensing: **`docs/SIMILARITY.md`**. Player-facing setup steps: `README.md`.

## Out of Scope (do not implement without an explicit request)

- Any 3D code or dependency (`three`, `@react-three/fiber`, `@react-three/drei`).
- Word-usage counter (V2).
- User accounts, authentication, leaderboard, Cloudflare D1 (V3).
- Monetization of any kind.

## Project Structure

```
/public                  # favicon.svg, favicon-48.png, apple-touch-icon.png — generated from the
                          # logo mark + tokens.css by `npm run favicon:build`, never edited by hand
/src
  main.tsx, App.tsx     # React entry point, top-level render of GameScreen
  roundStorage.ts        # localStorage persistence so a reload resumes today's round
                          # (deferred/idle writes, flushed on tab hide/close)
  roomStorage.ts          # the room the player is in (code, member token), so a reload reconnects
  theme.ts                 # light/dark: stored choice or system setting, applied as <html data-theme>
  /api                    # client.ts: fetchRound, submitGuess; rooms.ts: create/join/leave/guess + socket URL;
                          # base.ts: the Worker's URL (VITE_API_BASE_URL in production)
  /components             # presentational React components (layout: "Lyrix v3" mockup)
    GameScreen.tsx        # top-level layout; wires useGame() and useRoom(), places close guesses onto the
                           # round (slots.ts), owns which dialog is open, the input ref, and
                           # the "show all lyrics" checkbox's local, unsigned reveal-all toggle
    AppHeader.tsx, Logo.tsx, GroupIcon.tsx  # sticky top bar, CSS logo mark + wordmark
    ThemeToggle.tsx         # header's sun/moon button; the theme is its own local state
    GroupFoundBanner.tsx   # "X a trouvé la chanson pour le groupe" + "Afficher la réponse" (#30)
    TitleGuess.tsx         # masked title, victory panel, and the "show all lyrics"
                           # checkbox once won (RoundView.victory), controlled by GameScreen
    NextSongCountdown.tsx  # victory panel's countdown to the next UTC midnight (local tick)
    LyricsBody.tsx          # masked lyrics, grouped by section; takes the reveal-all toggle
    TokenRun.tsx             # one line: keeps each word on one line with its punctuation
    WordToken.tsx           # one token: found word (last found highlighted), bar, close-guess
                            # bar, revealed-via-checkbox text (DisplayToken.revealHint), dev
                            # hint; a tapped or focused bar shows its letter count (local state);
                            # screen readers read "mot caché, N lettres", never the underscores
    heatStyle.ts             # inline --heat a scored word is shaded with
    GuessForm.tsx             # sticky guess dock: input, feedback line, shake on a miss
    ProgressCard.tsx, TriedWords.tsx  # side column: % revealed + counts; past guesses,
                                      # sorted by score, crediting the embedding model;
                                      # "Mots du groupe" in a room, a colour dot per chip
                                      # (collapsed by default below 880px)
    Modal.tsx, HowToPlay.tsx   # dialog shell (Escape/backdrop, exit animation); the rules
    MultiplayerModal.tsx      # rooms (#29): "Créer un salon" / "Rejoindre" tabs, or the room once in one
    RoomCard.tsx, RoomMembers.tsx, CopyCodeButton.tsx, playerColor.ts  # dark "Salon" card, member
                              # list/grid, "Copié !" flash, a player's stable colour
    MultiplayerPromo.tsx       # "Chercher à plusieurs" card, hidden while in a room
  /hooks
    useGame.ts              # round/guess state machine; hydrates from roundStorage before network;
                            # in a room, plays the room's round instead (fed by useRoom, #30)
    useRovingBlanks.ts       # one tab stop per title/lyrics, arrow keys move between bars (#33)
    useRoom.ts                # room state, its WebSocket (reconnect with backoff, keep-alive); room
                              # events reach the dock's feedback line through useGame's announce(),
                              # round messages go to useGame's receiveRoomRound()
  /game                       # masking/matching/normalization — framework-agnostic, unit-tested,
                               # imported by BOTH the frontend and the Worker
    types.ts, tokenize.ts, normalize.ts  # wire contract; word/non-word tokenizer (elisions,
                                          # digit runs); case/accent-insensitive matching key
    analyze.ts               # one tokenize+normalize pass per song, memoized (see "Performance")
    mask.ts                   # masked DisplayToken views + victory check
    progress.ts                # share of word occurrences revealed (progress card)
    daily.ts                    # time until the next song (UTC midnight), countdown format
    similarity.ts, functionWords.ts, slots.ts  # 0-100 proximity scale; excluded function words;
                                                # addressing hidden words by position
    room.ts                     # rooms' wire contract: codes, pseudos, close codes, room round, message parsing
  /styles                    # tokens.css (v3 light + dark palettes), global.css (keyframes), game.css
                             # (layout; breakpoints are CSS media queries, never JS)
/worker/src
  index.ts                  # Hono app: GET /api/round, POST /api/guess, mounts /api/rooms; exports Room
  round.ts                    # checking a guess and building the masked view: shared by solo and rooms
  room.ts, roomRoutes.ts      # the Room Durable Object (members, round, expiry alarm); /api/rooms routes
  catalog.ts                  # curated {id, artist, title} list + deterministic daily pick
  lrclib.ts, lyrics.ts          # LRCLIB /api/search client; cleanLyrics (drops LRC markup: timestamps,
                                 # id tags, section headers, instrumental filler) + section parsing
  cache.ts                       # Workers Cache API wrapper, no-ops under plain-Node Vitest
  resolveSong.ts, songs.ts         # catalog entry -> playable Song (null below MIN_LYRIC_WORDS);
                                    # isolate memo, fallback chain, emergency song for a full outage
  similarity.ts, sampleSimilarity.ts # reads the precomputed KV table per guess; dev/e2e placeholder
  state.ts                            # HMAC-signed round state (songId + foundKeys) via Web Crypto
/worker
  wrangler.toml              # Worker config: ROOMS Durable Object + migration, room rate limits,
                              # SIMILARITY binding (commented)
  wrangler.debug.toml         # same Worker + a local-only SIMILARITY namespace (npm run dev:debug)
/scripts                     # Node tooling via tsx, never bundled into the Worker
  ensure-dev-vars.ts, check-catalog.ts, convert-embeddings.ts, build-similarity-table.ts,
  dev-debug.ts, inspect-similarity-table.ts, build-favicon.ts, graph-update.ts
  /lib/embeddings.ts, vocabulary.ts, similarityTable.ts, debugMode.ts, devVars.ts, catalogAudit.ts,
       favicon.ts, graphFixes.ts
/tests
  /unit/game, /unit/worker, /unit/scripts, /unit/storage, /unit/components, /unit/api, /unit/ci
  /e2e                        # Playwright; fixtures/similarity-table.json stands in for a built table
/docs
  LEARNINGS.md, SIMILARITY.md
```

**Anti-cheat shape**: the Worker is the only code that ever sees unmasked lyrics. Every response sends already-masked display tokens plus an opaque HMAC-signed `state` string encoding found words so far; the client only echoes it back. This keeps the Worker stateless while making forged "already found" progress impossible.

**Dev wiring**: `vite.config.ts` proxies `/api/*` (WebSockets included, for rooms) to the Worker at `localhost:8787`, so the frontend always calls a relative `/api/...` URL in dev and production. `src/game` is not a published package — the root and Worker `tsconfig.json` each `include` it by relative path, so Vite and Wrangler bundle it independently from the same source.

## Configuration

`STATE_SECRET` (the key the Worker signs round state with) is the only secret the app needs. Local dev reads it from `worker/.dev.vars` (created automatically by `predev:worker`), production from `wrangler secret put STATE_SECRET`. It is deliberately **not** in `wrangler.toml`: Cloudflare rejects a `var` and a `secret` sharing one binding name.

Two standing rules — a missing `worker/.dev.vars` has broken CI once and a developer's machine once, both times as an opaque Web Crypto `DataError`:

- **A gitignored config file is never a manual setup step.** Script its creation and hang the script off the command that needs it. A README step is a step someone will skip, and CI skips it every time.
- **Missing configuration must name itself.** Anything read from `env` is checked where it is read, with an error naming which variable is missing and how to set it, in both dev and production.

## Deployment

- Frontend to Cloudflare Pages, API to Cloudflare Workers, via Wrangler.
- GitHub Actions: run tests, then deploy on merge to `main`.
- The `Room` Durable Object ships with the Worker: its class and storage come from `[[migrations]]` in `worker/wrangler.toml`, applied by the deploy itself. Never edit or remove a migration that has shipped; renaming or deleting the class takes a new tag. `wrangler.debug.toml` repeats every binding but the KV one (`tests/unit/ci/debugMode.test.ts`).

## graphify

This project maintains a knowledge graph at `graphify-out/` (god nodes, community structure, cross-file relationships) via the `/graphify` skill. The graph (`graph.json`, `graph.html`, `GRAPH_REPORT.md`, `manifest.json`) and the semantic cache (the paid LLM extraction of the docs) are committed; `graphify-out/.gitignore` keeps machine-local files out. `.graphifyignore` keeps the skill's own docs out of the graph.

- **Code changes**: `npm run graph:update` — `graphify update .` (AST only: free, seconds) plus dropping the edges graphify is known to get wrong here (`scripts/lib/graphFixes.ts`; add one there, with its reason, rather than editing `graph.json` by hand). In cloud sessions the SessionStart hook (`.claude/hooks/session-start.sh`) runs it whenever the committed graph is older than the code, so the working tree may start with `graphify-out/` modified: never stage it with an unrelated change — commit a graph refresh on its own (`🔧 chore(graphify): refresh the knowledge graph`).
- **Doc changes** (`*.md`, `ci.yml`, `index.html`) need a semantic re-extraction: `/graphify . --update` in Claude Code, which costs tokens — batch it rather than running it per edit.
- `graphify update` re-clusters and names communities after their hub node; curated names don't survive it. Known graphify defects are logged in `docs/LEARNINGS.md` (2026-09-29).

- For codebase questions, first run `graphify query "<question>"` once `graphify-out/graph.json` exists; `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain don't surface enough.
- After modifying code, run `npm run graph:update` (not bare `graphify update .`) to keep the graph current.

## Reference docs

- `docs/LEARNINGS.md` — dated log of gotchas and bug root causes; read before repeating past mistakes, write to after finding a new one.
- `docs/SIMILARITY.md` — full semantic proximity scoring pipeline, tuning constants, and rules; read before touching similarity/scoring code.

# CLAUDE.md

This file gives Claude Code the context and rules needed to work on this project. Keep it in English and keep it up to date — see "Continuous Improvement Loop" below.

## Project Overview

A free web game inspired by Pedantix, built around song lyrics instead of Wikipedia articles. The player types words to progressively reveal a song's lyrics; the round is won once the title is fully uncovered.

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
- **Lyrics source**: LRCLIB (lrclib.net) — free, keyless API. Optionally the Genius API for song search/autocomplete metadata only (Genius does not provide lyrics text itself).
- **Database**: none needed for the MVP. Cloudflare D1 is reserved for a later phase (accounts, leaderboard) — do not add it now.
- **Planned, not yet in scope**: `@react-three/fiber` + `@react-three/drei` for in-game 3D (paper sheet, scrollable in-scene computer screen, in-scene settings menu); word-similarity scoring (semantic embeddings) for a Cemantix-style hint system; team mode; word-usage counter.

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

## Out of Scope (do not implement without an explicit request)

- Any 3D code or dependency (`three`, `@react-three/fiber`, `@react-three/drei`).
- Word-similarity / semantic scoring (V2).
- Team mode, word-usage counter (V2).
- User accounts, authentication, leaderboard, Cloudflare D1 (V3).
- Monetization of any kind.

## Proposed Project Structure

This is a starting point — adjust as the project actually takes shape, and keep this section in sync with reality.

```
/src                # React frontend
  /components
  /game             # masking, matching, game-state logic (framework-agnostic, unit-testable)
/worker             # Cloudflare Worker (Hono) — lyrics fetch, secret-keeping, guess validation
/tests
  /unit
  /e2e
/docs
  LEARNINGS.md
CLAUDE.md
```

## Deployment

- Frontend deploys to Cloudflare Pages, API to Cloudflare Workers, via Wrangler.
- GitHub Actions: run tests, then deploy on merge to `main`.

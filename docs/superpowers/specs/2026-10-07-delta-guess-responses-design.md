# Delta guess responses — design

Date: 2026-10-07. Status: approved in discussion, awaiting spec review.

## Problem

Every guess, missed or found, rebuilds and ships the whole masked round:

- `POST /api/guess` calls `buildRoundView` and returns the full `GuessResult` (about 34 KB of raw JSON for a 360-word song, about 800 objects built, serialized and parsed again). This breaks the rule that nothing in the Worker's per-guess path scales with the length of the song.
- A missed guess changes nothing in the view but `state`; a found one only reveals that word's occurrences.
- On the client, `useGame` replaces `round` with the answer and `placeNearGuesses` rebuilds every line, so the whole song re-renders on every guess (about 800 `WordToken`s).
- In a room, `Room.#guess` broadcasts the full view, every guess so far (O(n²) over the day) and every day's summary.

## Goals

- A missed guess gets a response whose size does not depend on the song's length, alone and in a room.
- A guess re-renders only the lines it changes, plus the lines holding the previously or newly highlighted word.
- Victory, "show all lyrics", close-guess placement, reload from localStorage, archives, rooms (reconnection, looking alone) behave as before.
- Clients and Workers of either version keep working together, for ever.

## Decisions

1. **Compatibility: client opt-in, full form kept for ever.** The new client asks for deltas (`delta: true` in the guess body, `?delta=1` on the room socket); a request that doesn't ask gets today's answer. The new client also accepts a full answer, which covers the window where CI has deployed Pages but not yet the Worker (Pages deploys first).
2. **Addressing: word positions** (`src/game/slots.ts`, already used by `near`). A found word reveals `{ position, text }` per occurrence, `text` being that occurrence's own spelling (case, accents, elisions).
3. **Consistency: monotonic, idempotent deltas, no version.** A delta only reveals words and adds guesses, so applying it twice or out of order converges. Rooms number guesses with `seq`. Every delta carries `revealed`, the number of revealed words in the round after it, as a checksum; a mismatch makes the client resync. **Anything that removes or replaces (a win, a change of day, a reconnection) is a full view, never a delta.**
4. **Storage: write only what changed.** A miss rewrites the day entry and the archive summary; the stored view is rewritten only when it changes.
5. **Anti-cheat and proximity:** no new form reveals more than the full view would; `near` is unchanged.

## 1. Wire contract

`src/game/types.ts`:

```ts
/** One occurrence a found guess uncovered: where it is, and how it is written there. */
export interface RevealedSlot {
  /** Same counting as NearSlot.position (src/game/slots.ts). */
  position: number;
  text: string;
}

/** What POST /api/guess answers a client that asked for `delta: true`, short of a win. */
export interface GuessDelta {
  kind: "delta";
  state: string;
  day: string;
  key: string;
  found: boolean;
  score: number | null;
  near: NearSlot[];
  /** Empty on a miss. */
  reveal: RevealedSlot[];
  /** Words revealed in the whole round after this guess: the client's checksum. */
  revealed: number;
}

/** GuessResult (the full view) is unchanged: older clients, and every win. */
export type GuessAnswer = GuessResult | GuessDelta;
```

The request body becomes `{ state, word, delta?: true }`. The client tells the two answers apart by `kind === "delta"`.

`src/game/room.ts`:

- `RoomGuess` gains `seq: number`, its rank in the round from 0. Optional when parsed: a guess stored before has none, and gets `length - 1 - index` (the list is newest first).
- New socket message:

  ```ts
  export interface RoomRoundDelta {
    type: "round-delta";
    day: string;
    /** The room's round state, sealed: kept in the GroupSnapshot. */
    state: string;
    guess: RoomGuess;
    reveal: RevealedSlot[];
    revealed: number;
    winningKey?: string;
    /** The room's day only. */
    summary: RoomDaySummary;
  }
  ```

- `POST /api/rooms/:code/guess` with `delta: true` answers a `RoomGuessDelta`: the fields of `RoomRoundDelta` (but `type`) plus `kind: "delta"` and `duplicate`.
- The socket opts in with `?delta=1`, kept in the WebSocket's attachment so it survives hibernation.

A miss's size still varies with two things that are not the song's length: `state` grows with the words found, `near` with the close occurrences.

## 2. Worker, alone

- `analyzeSong` (`src/game/analyze.ts`) gains `wordTexts: readonly string[]`, each word's text by position, and the song's total word count, from the same single pass.
- `round.ts` gains:

  ```ts
  export async function buildGuessDelta(
    song: Song, foundKeys: ReadonlySet<string>, outcome: GuessOutcome, env: RoundEnv, day: string
  ): Promise<Pick<GuessDelta, "state" | "day" | "reveal" | "revealed">>
  ```

  It seals `state`; builds `reveal` only when `outcome.found`, from `positions.get(key)` and `wordTexts`, so no hidden word's text is read before its guess is checked; and computes `revealed` as the sum of `positions.get(k).length` over the found keys: O(found keys), not O(song).
- `POST /api/guess`: after `evaluateGuess`, `isVictory` (title only). No `delta` asked, or a win: today's path, `buildRoundView`, full `GuessResult`. Otherwise `buildGuessDelta` and no `buildRoundView` at all.
- A found word sent again by a raw request reveals positions already revealed: harmless, and `revealed` stays right (keys go through a `Set`).
- `devHint`s came with the initial view and stay on the tokens still hidden; `revealHint` only exists on a win, which is always a full view.

## 3. Rooms

- `#guess` gives each new guess `seq = round.guesses.length`.
- `#summarizeFrom` stops reading the view: the title from `buildTitleView` (title-sized), `percent` from `revealed` over the song's word count, equal to `revealedPercent` (pinned by a test on a real song).
- After a new guess:
  - **The round is won** (before, or by this guess): unchanged, the full `RoomRoundMessage` to everyone and a full `RoomGuessResult`. A won view carries `revealHint`s that a delta would have to remove.
  - **Otherwise:** `buildGuessDelta` and the summary. Sockets that opted in get a `RoomRoundDelta`; the others get the full message, `buildRoundView` being called only if one of them is connected. The answer is a `RoomGuessDelta` when asked, the full answer otherwise.
  - **A duplicate:** a delta with `duplicate: true`, `reveal: []`, the earlier guess and the current `revealed`.
- Unchanged, full: `admit` (connection, reconnection), `#setDay`, `/alone`. `#viewOf` serves them, and is invalidated rather than rebuilt when a guess changes the round.
- A broadcast no longer carries the guess list nor every day's summary: constant per guess.

## 4. Client

`src/game/delta.ts`, framework-agnostic:

- `applyReveal(view, reveal, state)` returns a new `RoundView`, copying only the title array, section, line and token each revealed position touches; everything else keeps its identity. A revealed token becomes `{ text, isWord: true, revealed: true }` (no `devHint`, as in a full view).
- The position → (title, or section/line/token) index is built once per song and carried over to derived views through a `WeakMap`: a song's layout never changes.
- The revealed-word count is computed once when a full view is loaded, then incremented by `applyReveal` by the tokens that actually went from hidden to revealed: checking the checksum is O(revealed).

`useGame`, alone: `submitGuess` sends `delta: true` and gets a `GuessAnswer`. A delta: `round = applyReveal(round, reveal, state)`; if the counts disagree, the guess's feedback is still shown and `resumeRound([state])` replaces the view in the background. A full view: replaces the round, as today.

`useGame`, in a room: `receiveRoomRound` also takes `round-delta`.

- A delta for another day than the one shown is ignored: a change of day always comes as a full message.
- The guess is merged by key into `triedWords`, ordered by `seq`, newest first; `applyReveal` updates the room's view; `winningKey` and `state` (for the `GroupSnapshot`) are taken; the summary replaces its day's in `days`.
- A gap (`seq` above the last known + 1) or a checksum mismatch makes `useRoom` reopen the socket, which goes through `admit`.
- The answer to the player's own guess goes through the same merge. `withRoomRound` stays for full messages.

`slots.ts`: `placeNearGuesses(round, bySlot, previous)` takes its previous result (a `useRef` in `GameScreen`) and keeps a line's previous output when its input line is the same object and no close-guess placement changed on its positions. Still an O(n) walk per guess, without allocating or rendering; the per-guess rule in `CLAUDE.md` is the Worker's.

Rendering: `TokenRun` is `memo()`'d with a custom comparison. A line skips rendering when its tokens are the same object, `revealAll` and `rankWords` are unchanged, and, when `lastFoundKey` changed, neither the old nor the new key is among the line's revealed words (a set computed once per line object, in a `WeakMap`). `LyricsBody`'s comment, which says every token re-renders on a guess, is corrected.

## 5. Local storage

`saveRoundSoon(round, triedWords, { viewChanged })`:

- **Always:** `lyrix:day:<day>` (state, tried words, `revealed`) and the `lyrix:archive` summary, its percentage from the client's revealed count rather than `revealedPercent` walking the view, its title from `round.title`.
- **Only when `viewChanged`** (a found word, or a full view received): `lyrix:view:<day>`, without `state`, with the `revealed` it reflects.
- Pending writes for a day are coalesced as today, their `viewChanged` OR-ed: a found word then a miss in the same idle window must still write the view.

`loadSavedRound`: the state of `lyrix:day` wins, the view's own is the fallback for data saved by the old client. When the day entry's `revealed` is above the view's, the view is behind: the round resumes through `POST /api/round/resume` instead of instantly. Data without `revealed` counts as up to date.

Unchanged: `GroupSnapshot`s (fed the room's `state` from a delta or a full message), past days (state only), flushing on `pagehide`/`visibilitychange`.

## 6. Anti-cheat

| Answer | Fields | Reveals |
| --- | --- | --- |
| Miss (alone) | `state`, `key`, `found`, `score`, `near`, `revealed` | Nothing new: `revealed` can be counted off the full view. |
| Found (alone) | the above plus `reveal` | Exactly the tokens the full view would turn `revealed: true`. |
| Win | full view | Unchanged. |
| Room delta | `guess`, `reveal`, `revealed`, `state`, `winningKey?`, `summary` | A subset of the full message, which already carries the summaries. |

No form names the song. `tests/unit/worker/titleLeak.ts` covers every new form.

## 7. Tests

Measured on `main` before any change, then pinned by tests that count work, never time:

| Measure | Where | Expected after |
| --- | --- | --- |
| Bytes of the same miss, same found words, on a short and a long song | `tests/unit/worker` | equal |
| `buildRoundView` calls for a miss and a found word (alone; room with no legacy socket) | `tests/unit/worker` | 0 |
| Bytes of a room broadcast at the Nth guess | `tests/unit/worker` | constant in N |
| `WordToken` renders per guess (miss, found) | `tests/unit/components/gameScreen.test.tsx` | only the touched or highlighted lines' |
| localStorage writes on a miss | `tests/unit/storage` | no `lyrix:view` write |

Correctness and compatibility:

- `delta.ts`: applying a delta to a full view deep-equals the view the Worker would build (a real song, accents and elisions); applying twice, or two deltas out of order, converges; untouched lines keep their identity.
- `titleLeak.ts`: no new form names the song; a `reveal` only points at words whose key is found.
- Compatibility: no `delta` gets today's answer byte for byte; the new client handles a full answer from an old Worker; a socket without `?delta=1` gets the full message; storage written by the old format loads.
- Resync: a checksum mismatch triggers `resume` alone and a reconnection in a room; a `seq` gap reconnects.
- Storage: a found word then a miss coalesced still write the view.
- The whole existing suite and `npm run test:e2e`.

## Delivery

Two PRs, one commit per logical change.

**PR 1, alone:**

1. `✨ feat(round): answer guesses with a delta when the client asks`: types, `wordTexts`, `buildGuessDelta`, the route, Worker tests.
2. `✨ feat(game): apply guess deltas to the round view`: `delta.ts`, `useGame` alone, resync.
3. `⚡️ perf(lyrics): re-render only the lines a guess changes`: shared `slots.ts`, memoized `TokenRun`, render-count test.
4. `⚡️ perf(storage): write the round view only when it changes`.

**PR 2, rooms:**

5. `✨ feat(rooms): broadcast guess deltas to rooms`: `seq`, summary without the view, socket opt-in, client side.
6. `📝 docs: …`: `CLAUDE.md` (deltas only add, anything else is a full view; anti-cheat section; project structure) and a `docs/LEARNINGS.md` entry. Each PR updates the docs its own changes touch; this commit closes what is left.

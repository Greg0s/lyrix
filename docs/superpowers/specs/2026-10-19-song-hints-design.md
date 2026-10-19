# Song hints — design

Date: 2026-10-19. Status: approved in discussion and on the mockups (the "Lyrix Indices" design canvas), implementation follows.

## Problem

A player stuck on a song has nothing to go on but the lyrics they have uncovered. Past a certain point, they give up rather than guess on. The game needs a way to help them that stays a choice: a player who wants to find the song unaided must be able to.

## Goals

- Three hints per song, unlocked one by one as the player guesses, each revealed only when the player picks it.
- The same in a room, where hints belong to the group.
- Nothing about a hint the player hasn't revealed ever reaches the client, like the lyrics themselves.
- Clients and Workers of either version keep working together; rounds started before the feature keep working.

## Decisions

1. **Three hints, the same three every day**: *Époque* (the decade: "Années 80"), *Type d'artiste* (solo artist man or woman, group or duo, and their country: "Une artiste belge", "Un groupe français") and *Style* (the musical genre: "Rock"). Comparable in strength, so which one to take depends on what the lyrics already told the player. Buttons show the label alone, no description.
2. **Unlocked by guesses**: at 20, 35 and 50 guesses (`HINT_THRESHOLDS`), one more hint may be revealed, and the player chooses which among those left (3, then 2, then 1). A guess is any word the Worker answered, found or not, as the "essais" count shows it. No stronger "last resort" hint.
3. **Unlocking never reveals.** A hint is revealed only on the player's click; one never taken stays hidden until the round is won.
4. **Gated by the Worker.** Hint values live in `worker/src/songFacts.ts`, never in the client bundle. A value crosses the wire only once revealed, or once the round is won (like `revealHint`). The guess count and the hints revealed are sealed in the round state, so neither can be forged.
5. **Rooms share their hints**: unlocked on the group's guesses, revealed by any member for everyone, with who picked it.
6. **Won rounds show the whole card**: every value, the unused ones marked "non utilisé", and "Trouvée avec N indice(s)" or "Trouvée sans indice !".

## 1. Song facts (`worker/src/songFacts.ts`)

One entry per catalog id, plus the dev stand-in song, curated by hand:

```ts
interface SongFacts {
  year: number;                  // release year; the hint shows its decade
  artist: "man" | "woman" | "group" | "duo";
  origin: "fr" | "be" | "qc" | "fr-rw";
  style: SongStyle;              // a small closed list: Chanson, Variété, Pop, Rock, Rap, …
}
```

`hintValues(songId)` formats them in French: `Années 60`, `Années 2000`; `Un artiste français`, `Une artiste belge`, `Un groupe français`, `Un duo français`; the style as is. *Artiste* rather than *chanteur*: it says solo and gender without calling a rapper a singer. A song with no entry has no hints: its views carry no `hints` field and the card is not shown.

Tests (`tests/unit/worker/songFacts.test.ts`): every catalog id has facts; no hint value shares a word (normalized, function words aside) with its song's title or artist.

## 2. Shared rules (`src/game/hints.ts`)

Imported by both sides: `HINT_IDS = ["era", "artistType", "style"]` (display order), `HINT_LABELS`, `HINT_THRESHOLDS = [20, 35, 50]`, `unlockedHints(tried)`, `canReveal(hints, id)`, `parseRoundHints(value)`, and the card's wording (`hintCardText`), so the copy that depends on counts is unit-tested apart from React.

## 3. Sealed state (`worker/src/state.ts`)

`StatePayload` gains two optional fields:

```ts
tried?: number;     // guesses the Worker answered on this round
hints?: HintId[];   // hints revealed, in the order chosen
```

Every guess answer seals `tried + 1`; a reveal seals `hints` plus one. A state sealed before hints has neither: `tried` is read as its found-word count (a lower bound: a missed guess left no trace) and `hints` as none. Merging states (`POST /api/round/resume`) takes the largest `tried` and the union of `hints`.

## 4. Wire contract (`src/game/types.ts`)

```ts
interface RoundHints {
  tried: number;                                // what unlocks the next hint
  used: HintId[];                               // in the order chosen
  values: Partial<Record<HintId, string>>;      // the used ones' text; every one's once won
}
RoundView.hints?: RoundHints;     // absent: a song without facts, or an older Worker
GuessDelta.hints?: RoundHints;    // the round's hints after the guess
interface HintAnswer { state: string; hints: RoundHints }
```

Optional everywhere: a client without hints ignores them, a client facing an older Worker shows no card.

## 5. Solo routes (`worker/src/index.ts`, `worker/src/round.ts`)

- `buildRoundView` and `buildGuessDelta` take the round's hint progress (`tried`, `used`) and attach `hints`; `freshRoundBody` builds tried 0, none used.
- `POST /api/guess` answers with `tried + 1` sealed, whether the word was found or not.
- `POST /api/round/hint { state, hint }`: 400 on a bad body or state, 404 for a song without hints, 409 once won or before the hint is unlocked (`used.length >= unlockedHints(tried)`); a hint already used answers 200 with the round as it stands (a double click). Answers a `HintAnswer`: a reveal changes no lyrics.

## 6. Rooms (`worker/src/room.ts`)

- `RoundRecord.hints?: { id: HintId; by: RoomMember }[]`; the room's views are built with `tried = guesses.length` and those ids. Its view memo is keyed on guesses and hints.
- `POST /api/rooms/:code/hint { token, hint, day, tab }`, same shape and answers as `/guess` (404 for a non-member, 409 when the room moved day), checked like the solo route on the group's count. The room's round is broadcast to every other connection, `latestHint` naming the hint, and answered as a `RoomRound`.
- `RoomRound.hints?: RoomHint[]` carries who picked each. Ordering two room rounds: more guesses wins, then more hints.
- `/alone` seals the room's hints and guess count (plus the player's own, merged) into the solo round it signs: a player looking alone keeps what the group revealed. The group snapshot kept while in a room carries them too, through its sealed state.

## 7. Client (`src/hooks/useGame.ts`, `src/roundStorage.ts`, `src/api/*`)

- `revealHint(id)`: solo, `POST /api/round/hint` then `round = { ...round, state, hints }`, saved; in a room, `POST /api/rooms/:code/hint`. One in flight at a time. The dock line then says what was revealed ("Époque : Années 90"); a teammate's reveal is announced the same way ("Léa a révélé l'indice Époque : Années 90").
- A guess whose answer makes a hint available announces it in the dock ("Un indice est débloqué."), with a "Choisir" button below 880px.
- Storage: the day entry keeps the round's `hints` next to its state, so today's saved view (rewritten only when words are revealed) is resumed with current hints.

## 8. UI

- **Hints card** (`HintsCard.tsx`, memoized) in the side column, under "Tes mots": header (title, then "N à choisir" or "N / 3"), one row per hint in display order — a button while it can be picked, its value once revealed, dashed and locked otherwise — a meter to the next threshold, and a line of rules. Outlined in the accent while a hint is waiting. From 880px it is always open; below, it is collapsed to its header like "Tes mots".
- Hierarchy: only a revealed value stands out (display face, semibold); labels and buttons are medium, everything else regular and muted.
- **Choice sheet** (`HintSheet.tsx`), opened by the dock's "Choisir": a bottom sheet listing the hints left, and "Plus tard".
- The side column scrolls on its own from 880px when taller than the screen, so a card at its bottom is never out of reach.
- Performance: revealing a hint or opening the sheet re-renders no lyrics (component test counting renders).

## 9. Tests

- Unit: thresholds and wording (`hints.test.ts`); sealing and legacy states (`state.test.ts`); the solo route — refused early, refused once won, idempotent, forged state refused, `tried` counted on misses (`hints.test.ts` in worker); merging; the room route and broadcast (`room.test.ts`); no hint value in any view before it is revealed (`titleLeak.ts`); storage round trip.
- Component: the card's states; a reveal re-renders no lyrics.
- E2E: guess 20 words, pick a hint, see it, reload, still there; in a room, a reveal reaches the other member.

## Out of scope

- A cross-check of the facts against Wikidata or MusicBrainz (the years and styles are hand-curated; a script could flag disagreements).
- Showing hints used in the archives' covers.

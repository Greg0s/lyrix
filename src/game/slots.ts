import { analyzeSong } from "./analyze";
import { clampScore } from "./similarity";
import type { DisplayToken, NearSlot, RoundView, Song } from "./types";

/**
 * Pointing at a hidden word without naming it.
 *
 * A missed guess that is close to a hidden word is shown in that word's place.
 * The Worker says *where* with a position: the word's index among every word
 * of the round, the title's first, then the lyrics' in reading order. Both
 * halves of that contract live in this file, because they only agree if they
 * count in exactly the same order:
 *  - wordPositions() is the Worker's half, reading the secret Song's analysis;
 *  - placeNearGuesses() is the frontend's, walking the masked RoundView that
 *    mask.ts builds from that same analysis, in the same order.
 *
 * Positions rather than an id stamped on every blank, on purpose: an id on each
 * masked word would tell the player which blanks hide the same word before
 * they have come close to any of them.
 */

/**
 * Normalized word -> every position it holds in the round. Worker-side: it
 * reads the unmasked song. Comes straight from the song's single tokenization
 * pass (see analyze.ts), so asking for it again on a later guess costs nothing.
 * Treat the result as read-only: it is shared with every other caller.
 */
export function wordPositions(song: Song): ReadonlyMap<string, readonly number[]> {
  return analyzeSong(song).positions;
}

/** Slots coming from the network or from storage aren't trusted: a malformed entry is dropped, never thrown on. */
export function parseNearSlots(value: unknown): NearSlot[] {
  if (!Array.isArray(value)) return [];
  const slots: NearSlot[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { position, score } = entry as Record<string, unknown>;
    if (typeof position !== "number" || !Number.isInteger(position) || position < 0) continue;
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    slots.push({ position, score: clampScore(score) });
  }
  return slots;
}

/** What a hidden word shows once a missed guess has come close to it. */
export interface NearGuess {
  /** The guess, as the player typed it. */
  text: string;
  score: number;
}

/** The part of a tried word that placement reads (see TriedWord in src/hooks/useGame.ts). */
export interface PlacedGuess {
  display: string;
  found: boolean;
  near: readonly NearSlot[];
}

/**
 * The closest missed guess so far for each hidden word, by position. `words`
 * is the tried-word list, most recent first. A later guess only takes a slot
 * over by being strictly closer, so an equally close one never makes the
 * lyrics flicker between the two.
 */
export function closestGuessBySlot(words: readonly PlacedGuess[]): Map<number, NearGuess> {
  const bySlot = new Map<number, NearGuess>();
  for (const word of [...words].reverse()) {
    if (word.found) continue;
    for (const { position, score } of word.near) {
      const current = bySlot.get(position);
      if (!current || score > current.score) bySlot.set(position, { text: word.display, score });
    }
  }
  return bySlot;
}

export interface SlotToken extends DisplayToken {
  /** Only ever set on a word that is still hidden. */
  near?: NearGuess;
}

export interface SlotSection {
  label: string;
  lines: { tokens: SlotToken[] }[];
}

export interface SlotView {
  title: SlotToken[];
  sections: SlotSection[];
}

/** What placeNearGuesses() was given and gave last time, so the next call can hand back what didn't change. */
export interface SlotMemo {
  round: Pick<RoundView, "title" | "sections">;
  bySlot: ReadonlyMap<number, NearGuess>;
  view: SlotView;
}

function sameNear(a: NearGuess | undefined, b: NearGuess | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.text === b.text && a.score === b.score);
}

/**
 * Frontend-side: lays each slot's closest guess onto the masked round. A
 * revealed word always shows itself instead.
 *
 * Given the previous call (`previous`), a line comes back as the very same
 * array when its masked tokens are (see applyReveal, src/game/delta.ts) and no
 * closest guess changed on it: that is what lets a memoized line (TokenRun)
 * skip rendering, so a guess only re-renders the lines it touched. A section,
 * and the sections, come back the same when all of theirs do.
 */
export function placeNearGuesses(
  round: Pick<RoundView, "title" | "sections">,
  bySlot: ReadonlyMap<number, NearGuess>,
  previous: SlotMemo | null = null
): SlotView {
  let position = 0;
  const place = (token: DisplayToken): SlotToken => {
    if (!token.isWord) return token;
    const near = token.revealed ? undefined : bySlot.get(position);
    position += 1;
    return near ? { ...token, near } : token;
  };
  const placeLine = (tokens: readonly DisplayToken[], before: readonly DisplayToken[] | undefined, placed: SlotToken[] | undefined): SlotToken[] => {
    if (previous && placed && before === tokens) {
      const start = position;
      let unchanged = true;
      for (const token of tokens) {
        if (!token.isWord) continue;
        if (unchanged && !token.revealed && !sameNear(bySlot.get(position), previous.bySlot.get(position))) unchanged = false;
        position += 1;
      }
      if (unchanged) return placed;
      position = start;
    }
    return tokens.map((token) => place(token));
  };

  // Title first, then the lyrics: the order wordPositions() counts in.
  const title = placeLine(round.title.tokens, previous?.round.title.tokens, previous?.view.title);
  let sectionsChanged = !previous || round.sections.length !== previous.view.sections.length;
  const sections = round.sections.map((section, sectionIndex) => {
    const sectionBefore = previous?.round.sections[sectionIndex];
    const placedSection = previous?.view.sections[sectionIndex];
    let linesChanged = !placedSection || section.lines.length !== placedSection.lines.length;
    const lines = section.lines.map((line, lineIndex) => {
      const placedLine = placedSection?.lines[lineIndex];
      const tokens = placeLine(line.tokens, sectionBefore?.lines[lineIndex]?.tokens, placedLine?.tokens);
      if (placedLine && tokens === placedLine.tokens) return placedLine;
      linesChanged = true;
      return { tokens };
    });
    if (placedSection && !linesChanged && section.label === placedSection.label) return placedSection;
    sectionsChanged = true;
    return { label: section.label, lines };
  });
  return {
    title,
    sections: !sectionsChanged && previous ? previous.view.sections : sections,
  };
}

/** placeNearGuesses(), handed its own previous call each time: one per screen showing a round (GameScreen). */
export function createNearPlacer(): (round: Pick<RoundView, "title" | "sections">, bySlot: ReadonlyMap<number, NearGuess>) => SlotView {
  let previous: SlotMemo | null = null;
  return (round, bySlot) => {
    const view = placeNearGuesses(round, bySlot, previous);
    previous = { round, bySlot, view };
    return view;
  };
}

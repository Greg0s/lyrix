import { normalize } from "./normalize";
import { clampScore } from "./similarity";
import { tokenize } from "./tokenize";
import type { DisplayToken, NearSlot, RoundView, Song } from "./types";

/**
 * Pointing at a hidden word without naming it.
 *
 * A missed guess that is close to a hidden word is shown in that word's place.
 * The Worker says *where* with a position: the word's index among every word
 * of the round, the title's first, then the lyrics' in reading order. Both
 * halves of that contract live in this file, because they only agree if they
 * count in exactly the same order:
 *  - wordPositions() is the Worker's half, walking the secret Song;
 *  - placeNearGuesses() is the frontend's, walking the masked RoundView that
 *    mask.ts builds from the same tokenize() runs, in the same order.
 *
 * Positions rather than an id stamped on every blank, on purpose: an id on each
 * masked word would tell the player which blanks hide the same word before
 * they have come close to any of them.
 */

/** Normalized word -> every position it holds in the round. Worker-side: it reads the unmasked song. */
export function wordPositions(song: Song): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  let position = 0;
  const visit = (text: string) => {
    for (const token of tokenize(text)) {
      if (!token.isWord) continue;
      const key = normalize(token.text);
      const existing = positions.get(key);
      if (existing) existing.push(position);
      else positions.set(key, [position]);
      position += 1;
    }
  };

  visit(song.title);
  song.sections.forEach((section) => section.lines.forEach((line) => visit(line)));
  return positions;
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

/** Frontend-side: lays each slot's closest guess onto the masked round. A revealed word always shows itself instead. */
export function placeNearGuesses(
  round: Pick<RoundView, "title" | "sections">,
  bySlot: ReadonlyMap<number, NearGuess>
): SlotView {
  let position = 0;
  const place = (token: DisplayToken): SlotToken => {
    if (!token.isWord) return token;
    const near = token.revealed ? undefined : bySlot.get(position);
    position += 1;
    return near ? { ...token, near } : token;
  };

  // Title first, then the lyrics: the order wordPositions() counts in.
  const title = round.title.tokens.map((token) => place(token));
  const sections = round.sections.map((section) => ({
    label: section.label,
    lines: section.lines.map((line) => ({ tokens: line.tokens.map((token) => place(token)) })),
  }));
  return { title, sections };
}

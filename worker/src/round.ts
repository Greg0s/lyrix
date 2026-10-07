import { analyzeSong } from "../../src/game/analyze";
import { buildSectionsView, buildTitleView, isVictory, songWordKeys } from "../../src/game/mask";
import { normalize } from "../../src/game/normalize";
import { MAX_PROXIMITY_SCORE } from "../../src/game/similarity";
import { wordPositions } from "../../src/game/slots";
import type { GuessDelta, NearSlot, RevealedSlot, RoundView, Song } from "../../src/game/types";
import { proximityHint, type SimilarityEnv } from "./similarity";
import { sealState } from "./state";

/**
 * What a guess does to a round, wherever it is played: alone (POST /api/guess,
 * index.ts) or in a room (the Room Durable Object, room.ts). Only the found
 * words differ between the two - signed and echoed back by the client alone,
 * held by the room's object in a room - never how a guess is checked or what
 * the player gets to see.
 */

export interface RoundEnv extends SimilarityEnv {
  STATE_SECRET: string;
  /**
   * Dev/e2e only, never set in production: makes every still-hidden word's
   * real text ride along as `devHint`, so the game can be played and the
   * close-word mechanic debugged without guessing blind. See CLAUDE.md's
   * anti-cheat section and DisplayToken.devHint.
   */
  DEV_REVEAL_LYRICS?: string;
}

export const MAX_WORD_LENGTH = 64;

// Dev-only, once per isolate: a quiet flag would otherwise look like a CSS bug
// the first time someone notices faint lyrics behind the blanks.
let devRevealAnnounced = false;

function devRevealOn(env: RoundEnv): boolean {
  const on = env.DEV_REVEAL_LYRICS === "1";
  if (on && !devRevealAnnounced) {
    devRevealAnnounced = true;
    console.log(
      "round: DEV_REVEAL_LYRICS is on - every still-hidden word's real text is attached as devHint. " +
        "Dev/e2e only, never set in production."
    );
  }
  return on;
}

/** A guess as typed, trimmed; null when it is empty or too long to be a word. */
export function parseGuessWord(word: unknown): string | null {
  if (typeof word !== "string") return null;
  const trimmed = word.trim();
  return trimmed.length === 0 || trimmed.length > MAX_WORD_LENGTH ? null : trimmed;
}

// Takes the resolved Song rather than an id: every caller has already resolved
// it by the time it gets here, and looking it up again would repeat a Cache API
// read and a full JSON parse of the lyrics for nothing.
export async function buildRoundView(
  song: Song,
  foundKeys: Iterable<string>,
  env: RoundEnv,
  day: string
): Promise<RoundView> {
  const foundSet = new Set(foundKeys);
  const devReveal = devRevealOn(env);
  const victory = isVictory(song, foundSet);
  const state = await sealState({ songId: song.id, foundKeys: [...foundSet], day }, env.STATE_SECRET);

  return {
    state,
    day,
    // Once the round is won, every still-hidden word's real text rides along
    // as `revealHint` (see DisplayToken and CLAUDE.md's anti-cheat section):
    // `victory` is recomputed here from server-held found words, so a player
    // can't reach this branch without the title actually having been found.
    title: { tokens: buildTitleView(song, foundSet, devReveal, victory) },
    sections: buildSectionsView(song, foundSet, devReveal, victory),
    victory,
    ...(victory ? { artist: song.artist } : {}),
  };
}

export interface GuessOutcome {
  key: string;
  found: boolean;
  score: number | null;
  near: NearSlot[];
}

/** How many word occurrences `foundKeys` reveal: what a delta's `revealed` says, in O(found words). */
export function revealedCount(song: Song, foundKeys: Iterable<string>): number {
  const positions = wordPositions(song);
  let count = 0;
  for (const key of new Set(foundKeys)) count += positions.get(key)?.length ?? 0;
  return count;
}

/**
 * What a guess changed, short of a win, for a client that asked for it
 * (GuessDelta): the sealed state, plus every occurrence of a found word.
 * Nothing in it scales with the song's length. A hidden word's text is only
 * read once its guess has been checked: `reveal` is empty on a miss.
 * `foundKeys` are the words found once the guess is counted.
 */
export async function buildGuessDelta(
  song: Song,
  foundKeys: Iterable<string>,
  outcome: GuessOutcome,
  env: RoundEnv,
  day: string
): Promise<GuessDelta> {
  const foundSet = new Set(foundKeys);
  const state = await sealState({ songId: song.id, foundKeys: [...foundSet], day }, env.STATE_SECRET);
  const { wordTexts } = analyzeSong(song);
  const reveal: RevealedSlot[] = outcome.found
    ? (wordPositions(song).get(outcome.key) ?? []).map((position) => ({ position, text: wordTexts[position] ?? "" }))
    : [];
  return { kind: "delta", state, day, ...outcome, reveal, revealed: revealedCount(song, foundSet) };
}

/** Checks one (already trimmed) guess against the song, given the words found before it. */
export async function evaluateGuess(
  env: RoundEnv,
  song: Song,
  foundKeys: ReadonlySet<string>,
  word: string
): Promise<GuessOutcome> {
  const key = normalize(word);
  const found = songWordKeys(song).has(key);
  // A found word is its own closest match and reveals itself, so it needs no
  // table lookup. A missed one gets its score plus the positions of the hidden
  // words it is close to - never those words themselves, and never a vector.
  if (found) return { key, found, score: MAX_PROXIMITY_SCORE, near: [] };
  const hint = await proximityHint(env, song, key, foundKeys);
  return { key, found, score: hint.score, near: hint.near };
}

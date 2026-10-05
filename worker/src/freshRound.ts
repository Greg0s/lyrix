import type { Song } from "../../src/game/types";
import { buildRoundView, type RoundEnv } from "./round";

/**
 * A round nobody has guessed on yet is the same for every player of its day:
 * the whole song masked, plus a sealed state with no found word, which is as
 * good for one player as for the next (it names nothing, and sealing it again
 * would only change its IV). Every first visit used to mask the whole song,
 * seal a state and serialize tens of kilobytes again; it is now done once per
 * song, day and configuration in an isolate, and the same body served after.
 * Keyed by the song object (see songs.ts): a song resolved again, or the
 * emergency song standing in, gets its own.
 */
let freshRounds = new WeakMap<Song, Map<string, string>>();

/** Drops the isolate's fresh rounds. For tests: production relies on a song never changing once resolved. */
export function resetFreshRoundMemo(): void {
  freshRounds = new WeakMap();
}

/** The body of GET /api/round for `song` on `day`: built once, then served as is. */
export async function freshRoundBody(song: Song, env: RoundEnv, day: string): Promise<string> {
  // The secret seals the state, and the dev flag adds every hidden word's text.
  const key = `${day}|${env.DEV_REVEAL_LYRICS === "1"}|${env.STATE_SECRET}`;
  let bodies = freshRounds.get(song);
  const cached = bodies?.get(key);
  if (cached !== undefined) return cached;
  const body = JSON.stringify(await buildRoundView(song, [], env, day));
  if (!bodies) {
    bodies = new Map();
    freshRounds.set(song, bodies);
  }
  bodies.set(key, body);
  return body;
}

import { utcDay } from "../../src/game/daily";
import { recordEvent, type EventsEnv } from "./events";
import { getSongOfDay, isDayPinned, pickOfDay, SongUnavailableError, type SongsEnv } from "./songs";

/**
 * The songs of the days to come, resolved ahead of time by a scheduled run
 * of the Worker (worker/wrangler.toml's [triggers]): each is fetched from
 * LRCLIB, cleaned and kept in the SONGS namespace before its day starts,
 * so UTC midnight no longer depends on LRCLIB answering at that very
 * moment (it didn't twice, docs/LEARNINGS.md, 2026-10-05 and 2026-10-18).
 * An entry LRCLIB has no usable lyrics for is found days ahead, in the
 * Worker's logs and `npm run stats`, rather than by the day's first players.
 *
 * Only today is pinned (its song is being played). A day to come is only
 * resolved, never pinned: the catalog may still change for it, and the day
 * takes whatever its rotation gives once it is played.
 */

/** How many days ahead a run prepares, today included: a week of margin for LRCLIB to be down. */
export const PREPARED_DAYS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PreparedOutcome = "ready" | "fallback" | "missing" | "unavailable";

export interface PreparedDay {
  day: string;
  outcome: PreparedOutcome;
  /** The song the day will play, when one could be resolved. */
  song?: string;
}

/**
 * Prepares today and the days after it, one at a time (LRCLIB asks for
 * sequential requests). Stops at the first day LRCLIB couldn't be asked
 * about: the next run tries again. Never throws.
 */
export async function prepareSongs(env: SongsEnv & EventsEnv, now: Date = new Date()): Promise<PreparedDay[]> {
  const prepared: PreparedDay[] = [];
  const today = utcDay(now);
  for (let ahead = 0; ahead < PREPARED_DAYS; ahead += 1) {
    const date = new Date(now.getTime() + ahead * DAY_MS);
    const day = utcDay(date);
    let result: PreparedDay;
    try {
      if (day === today) {
        const song = await getSongOfDay(date, env);
        result = { day, outcome: "ready", song: song.id };
      } else if (await isDayPinned(day, env)) {
        result = { day, outcome: "ready" };
      } else {
        const pick = await pickOfDay(date, env);
        if (!pick) result = { day, outcome: "missing" };
        else if (pick.passedOver.length > 0) result = { day, outcome: "fallback", song: pick.song.id };
        else result = { day, outcome: "ready", song: pick.song.id };
        if (pick && pick.passedOver.length > 0) {
          console.warn(
            `prepare: LRCLIB has no usable lyrics for ${pick.passedOver.map((entry) => `"${entry.id}"`).join(", ")}, ` +
              `${day}'s pick: "${pick.song.id}" will play instead. Run npm run catalog:check.`
          );
        }
        if (!pick) console.error(`prepare: no song of ${day}'s rotation has usable lyrics on LRCLIB. Run npm run catalog:check.`);
      }
    } catch (error) {
      if (!(error instanceof SongUnavailableError)) {
        console.error(`prepare: ${day} failed`, error);
      }
      result = { day, outcome: "unavailable" };
    }
    prepared.push(result);
    recordEvent(env, "prepare", { day, outcome: result.outcome, song: result.song ?? "", ahead });
    // LRCLIB down: the days after would only fail the same way.
    if (result.outcome === "unavailable") break;
  }
  return prepared;
}

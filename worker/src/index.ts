import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { dayStart, isDayKey, isPlayableDay, utcDay } from "../../src/game/daily";
import { canReveal, isHintId } from "../../src/game/hints";
import type { GuessResult, HintAnswer, HintId } from "../../src/game/types";
import { freshRoundBody } from "./freshRound";
import { isVictory } from "../../src/game/mask";
import {
  buildGuessDelta,
  buildRoundView,
  evaluateGuess,
  MAX_WORD_LENGTH,
  parseGuessWord,
  roundHints,
  sealRound,
  type RoundEnv,
} from "./round";
import { roomRoutes, type RoomsEnv } from "./roomRoutes";
import { getSongById, getSongOfDay, SongUnavailableError } from "./songs";
import { hintProgressOf, openState, type HintProgress } from "./state";

type Env = RoundEnv & RoomsEnv;

const app = new Hono<{ Bindings: Env }>();

/** How long a client is asked to wait before trying again a song LRCLIB couldn't give. */
const SONG_RETRY_AFTER_SECONDS = 5;

/**
 * The answer when the song couldn't be had right now (songs.ts): a 503 the
 * client tries again, never another song, and never "invalid state", which
 * would make it start the day afresh (src/hooks/useGame.ts, fetchDay).
 */
function songUnavailable(c: Context<{ Bindings: Env }>, error: unknown): Response {
  if (!(error instanceof SongUnavailableError)) throw error;
  c.header("Retry-After", String(SONG_RETRY_AFTER_SECONDS));
  return c.json({ error: "the song is unavailable, try again" }, 503);
}

// Pages and the Worker sit on different origins (see the deploy job in
// .github/workflows/ci.yml), so POST /api/guess is a cross-origin request with
// a JSON content type: the browser preflights it. Hono sends no
// Access-Control-Max-Age by default, which leaves browsers on their own
// default of a few seconds — near enough one extra round trip per guess, on
// the path the player is waiting on. A day (browsers clamp it to their own
// maximum, 2h in Chromium) makes it one preflight per session instead.
const PREFLIGHT_MAX_AGE_SECONDS = 86_400;

app.use("/api/*", cors({ maxAge: PREFLIGHT_MAX_AGE_SECONDS }));

// Without this, a missing STATE_SECRET used to surface as an opaque Web Crypto
// "Imported HMAC key length (0)" DataError, several frames deep (sealState
// now throws its own error, still from deep inside a request) and saying
// nothing about the actual problem - a config file that was
// never created. That has cost real time twice (see docs/LEARNINGS.md), so
// the misconfiguration now names itself in the Worker's own log.
app.use("/api/*", async (c, next) => {
  if (typeof c.env.STATE_SECRET !== "string" || c.env.STATE_SECRET.length === 0) {
    console.error(
      "STATE_SECRET is not set, so round state can't be signed. " +
        "Local dev: copy worker/.dev.vars.example to worker/.dev.vars (npm run dev:worker does it for you). " +
        "Production: npx wrangler secret put STATE_SECRET --config worker/wrangler.toml."
    );
    return c.json({ error: "server is misconfigured" }, 500);
  }
  return next();
});

// Today's round, or with ?day=YYYY-MM-DD the round of a day the archives
// hold: one that had a song, among the last ARCHIVE_DAYS, never one to come -
// tomorrow's song stays secret.
app.get("/api/round", async (c) => {
  const requested = c.req.query("day");
  if (requested !== undefined && !isDayKey(requested)) {
    return c.json({ error: "day must be a date written YYYY-MM-DD" }, 400);
  }
  if (requested !== undefined && !isPlayableDay(requested)) {
    return c.json({ error: "no round for that day" }, 404);
  }
  const day = requested ?? utcDay();
  let song;
  try {
    song = await getSongOfDay(dayStart(day), c.env);
  } catch (error) {
    return songUnavailable(c, error);
  }
  return c.body(await freshRoundBody(song, c.env, day), 200, { "Content-Type": "application/json" });
});

/** How many sealed states one resume may merge: a round's own, plus a room's (see POST /api/round/resume). */
const MAX_RESUMED_STATES = 4;

/**
 * The view of a round from its sealed state, with nothing guessed: how the
 * archives resume a day they only kept the state of (src/roundStorage.ts).
 * Several states of the same round (same song, same day) are merged, their
 * found words put together - how a room's progress joins the player's own.
 * Only states the Worker sealed itself count, so nothing found can be forged.
 * `day` names the round of a state sealed before the archives, which has none.
 */
app.post("/api/round/resume", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "request body must be a JSON object" }, 400);
  }
  const { states, day: hint } = body as Record<string, unknown>;
  if (
    !Array.isArray(states) ||
    states.length === 0 ||
    states.length > MAX_RESUMED_STATES ||
    !states.every((state) => typeof state === "string")
  ) {
    return c.json({ error: `states must be 1 to ${MAX_RESUMED_STATES} round states` }, 400);
  }
  if (hint !== undefined && !isDayKey(hint)) {
    return c.json({ error: "day must be a date written YYYY-MM-DD" }, 400);
  }

  const payloads = await Promise.all(states.map((state: string) => openState(state, c.env.STATE_SECRET)));
  const opened = payloads.filter((payload) => payload !== null);
  if (opened.length !== payloads.length) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }
  const [first] = opened;
  const day = first.day ?? hint ?? utcDay();
  if (opened.some((payload) => payload.songId !== first.songId || (payload.day ?? hint ?? utcDay()) !== day)) {
    return c.json({ error: "those states are not of the same round" }, 400);
  }

  let song;
  try {
    song = await getSongById(first.songId, c.env);
  } catch (error) {
    return songUnavailable(c, error);
  }
  if (!song) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }
  const foundKeys = new Set(opened.flatMap((payload) => payload.foundKeys));
  // Hints too: as many guesses as the furthest state counted, every hint any of them revealed.
  const progresses = opened.map(hintProgressOf);
  const used: HintId[] = [];
  for (const id of progresses.flatMap((progress) => progress.used)) if (!used.includes(id)) used.push(id);
  const progress: HintProgress = { tried: Math.max(...progresses.map((p) => p.tried)), used };
  return c.json(await buildRoundView(song, foundKeys, c.env, day, progress));
});

app.post("/api/guess", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return c.json({ error: "request body must be a JSON object" }, 400);
  }
  const { state, word, delta } = body as Record<string, unknown>;
  if (typeof state !== "string" || typeof word !== "string") {
    return c.json({ error: "state and word must both be strings" }, 400);
  }

  const trimmed = parseGuessWord(word);
  if (trimmed === null) {
    return c.json({ error: `word must be between 1 and ${MAX_WORD_LENGTH} characters` }, 400);
  }

  const payload = await openState(state, c.env.STATE_SECRET);
  if (!payload) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }

  let song;
  try {
    song = await getSongById(payload.songId, c.env);
  } catch (error) {
    return songUnavailable(c, error);
  }
  if (!song) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }

  const outcome = await evaluateGuess(c.env, song, new Set(payload.foundKeys), trimmed);
  const foundKeys = outcome.found ? [...payload.foundKeys, outcome.key] : payload.foundKeys;
  // A state sealed before the archives has no day: it can only be a round of today.
  const day = payload.day ?? utcDay();
  // Every guess answered counts towards the next hint, found or not.
  const before = hintProgressOf(payload);
  const progress: HintProgress = { tried: before.tried + 1, used: before.used };

  // A client that asked for it gets what the guess changed rather than the
  // whole round, short of a win: a won round's view carries the artist and
  // every hidden word's revealHint. One that didn't ask (a tab still running
  // an older build) gets the full view, as it always has, for ever.
  if (delta === true && !isVictory(song, new Set(foundKeys))) {
    return c.json(await buildGuessDelta(song, foundKeys, outcome, c.env, day, progress));
  }

  const view = await buildRoundView(song, foundKeys, c.env, day, progress);

  const result: GuessResult = { ...view, ...outcome };
  return c.json(result);
});

/**
 * Reveals one of the round's hints (src/game/hints.ts): one the guesses
 * sealed in the state have unlocked and no earlier reveal used up, never
 * once the round is won (every hint is shown then). A hint already revealed
 * answers the round as it stands, so a double click is harmless. Only the
 * state and the hints come back: a hint changes no lyrics.
 */
app.post("/api/round/hint", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "request body must be a JSON object" }, 400);
  }
  const { state, hint } = body as Record<string, unknown>;
  if (typeof state !== "string" || !isHintId(hint)) {
    return c.json({ error: "state must be a round state and hint one of the song's hints" }, 400);
  }

  const payload = await openState(state, c.env.STATE_SECRET);
  if (!payload) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }
  let song;
  try {
    song = await getSongById(payload.songId, c.env);
  } catch (error) {
    return songUnavailable(c, error);
  }
  if (!song) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }
  const progress = hintProgressOf(payload);
  const current = roundHints(song, progress, false);
  if (!current) {
    return c.json({ error: "this song has no hints" }, 404);
  }
  if (isVictory(song, new Set(payload.foundKeys))) {
    return c.json({ error: "the round is already won" }, 409);
  }
  if (progress.used.includes(hint)) {
    const answer: HintAnswer = { state, hints: current };
    return c.json(answer);
  }
  if (!canReveal(progress, hint)) {
    return c.json({ error: "no hint is unlocked yet" }, 409);
  }
  const next: HintProgress = { tried: progress.tried, used: [...progress.used, hint] };
  const day = payload.day ?? utcDay();
  const answer: HintAnswer = {
    state: await sealRound(song, payload.foundKeys, c.env, day, next),
    hints: roundHints(song, next, false) ?? current,
  };
  return c.json(answer);
});

// Rooms ("salons", issue #29), and the round each plays together (#30).
app.route("/api/rooms", roomRoutes);

export default app;
// The room's Durable Object class, which the runtime looks up by name (see worker/wrangler.toml).
export { Room } from "./room";

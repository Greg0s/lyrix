import { Hono } from "hono";
import { cors } from "hono/cors";
import type { GuessResult } from "../../src/game/types";
import { buildRoundView, evaluateGuess, MAX_WORD_LENGTH, parseGuessWord, type RoundEnv } from "./round";
import { roomRoutes, type RoomsEnv } from "./roomRoutes";
import { getSongById, getTodaysSong } from "./songs";
import { openState } from "./state";

type Env = RoundEnv & RoomsEnv;

const app = new Hono<{ Bindings: Env }>();

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

app.get("/api/round", async (c) => {
  const song = await getTodaysSong();
  return c.json(await buildRoundView(song, [], c.env));
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
  const { state, word } = body as Record<string, unknown>;
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

  const song = await getSongById(payload.songId);
  if (!song) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }

  const outcome = await evaluateGuess(c.env, song, new Set(payload.foundKeys), trimmed);
  const foundKeys = outcome.found ? [...payload.foundKeys, outcome.key] : payload.foundKeys;
  const view = await buildRoundView(song, foundKeys, c.env);

  const result: GuessResult = { ...view, ...outcome };
  return c.json(result);
});

// Rooms ("salons", issue #29), and the round each plays together (#30).
app.route("/api/rooms", roomRoutes);

export default app;
// The room's Durable Object class, which the runtime looks up by name (see worker/wrangler.toml).
export { Room } from "./room";

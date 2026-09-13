import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildSectionsView, buildTitleView, isVictory, songWordKeys } from "../../src/game/mask";
import { normalize } from "../../src/game/normalize";
import { MAX_PROXIMITY_SCORE } from "../../src/game/similarity";
import type { GuessResult, RoundView } from "../../src/game/types";
import { proximityHint, type ProximityHint, type SimilarityEnv } from "./similarity";
import { getSongById, getTodaysSong } from "./songs";
import { signState, verifyState } from "./state";

interface Env extends SimilarityEnv {
  STATE_SECRET: string;
}

const MAX_WORD_LENGTH = 64;

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// Without this, a missing STATE_SECRET surfaces as an opaque Web Crypto
// "Imported HMAC key length (0)" DataError from signState, several frames
// deep and saying nothing about the actual problem - a config file that was
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

async function buildRoundView(songId: string, foundKeys: string[], secret: string): Promise<RoundView | null> {
  const song = await getSongById(songId);
  if (!song) return null;

  const foundSet = new Set(foundKeys);
  const victory = isVictory(song, foundSet);
  const state = await signState({ songId, foundKeys: [...foundSet] }, secret);

  return {
    songId: song.id,
    state,
    title: { tokens: buildTitleView(song, foundSet) },
    sections: buildSectionsView(song, foundSet),
    victory,
    ...(victory ? { artist: song.artist } : {}),
  };
}

app.get("/api/round", async (c) => {
  const song = await getTodaysSong();
  const view = await buildRoundView(song.id, [], c.env.STATE_SECRET);
  if (!view) return c.json({ error: "no songs available" }, 500);
  return c.json(view);
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

  const trimmed = word.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_WORD_LENGTH) {
    return c.json({ error: `word must be between 1 and ${MAX_WORD_LENGTH} characters` }, 400);
  }

  const payload = await verifyState(state, c.env.STATE_SECRET);
  if (!payload) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }

  const song = await getSongById(payload.songId);
  if (!song) {
    return c.json({ error: "invalid or expired round state" }, 400);
  }

  const key = normalize(trimmed);
  const found = songWordKeys(song).has(key);
  const newFoundKeys = found ? [...new Set([...payload.foundKeys, key])] : payload.foundKeys;

  const view = await buildRoundView(song.id, newFoundKeys, c.env.STATE_SECRET);
  if (!view) return c.json({ error: "invalid or expired round state" }, 400);

  // A found word is its own closest match and reveals itself, so it needs no
  // table lookup. A missed one gets its score plus the positions of the hidden
  // words it is close to - never those words themselves, and never a vector.
  const hint: ProximityHint = found
    ? { score: MAX_PROXIMITY_SCORE, near: [] }
    : await proximityHint(c.env, song, key, new Set(newFoundKeys));

  const result: GuessResult = { ...view, found, key, score: hint.score, near: hint.near };
  return c.json(result);
});

export default app;

import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildSectionsView, buildTitleView, isVictory, songWordKeys } from "../../src/game/mask";
import { normalize } from "../../src/game/normalize";
import type { GuessResult, RoundView } from "../../src/game/types";
import { getSongById, getTodaysSong } from "./songs";
import { signState, verifyState } from "./state";

interface Env {
  STATE_SECRET: string;
}

const MAX_WORD_LENGTH = 64;

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

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

  const result: GuessResult = { ...view, found, key };
  return c.json(result);
});

export default app;

import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildSectionsView, buildTitleView, isVictory, songWordKeys } from "../../src/game/mask";
import { normalize } from "../../src/game/normalize";
import { MAX_PROXIMITY_SCORE } from "../../src/game/similarity";
import type { GuessResult, RoundView, Song } from "../../src/game/types";
import { proximityHint, type ProximityHint, type SimilarityEnv } from "./similarity";
import { getSongById, getTodaysSong } from "./songs";
import { signState, verifyState } from "./state";

interface Env extends SimilarityEnv {
  STATE_SECRET: string;
  /**
   * Dev/e2e only, never set in production: makes every still-hidden word's
   * real text ride along as `devHint`, so the game can be played and the
   * close-word mechanic debugged without guessing blind. See CLAUDE.md's
   * anti-cheat section and DisplayToken.devHint.
   */
  DEV_REVEAL_LYRICS?: string;
}

const MAX_WORD_LENGTH = 64;

const app = new Hono<{ Bindings: Env }>();

// Dev-only, once per isolate: a quiet flag would otherwise look like a CSS bug
// the first time someone notices faint lyrics behind the blanks.
let devRevealAnnounced = false;

function announceDevReveal(): void {
  if (devRevealAnnounced) return;
  devRevealAnnounced = true;
  console.log(
    "round: DEV_REVEAL_LYRICS is on - every still-hidden word's real text is attached as devHint. " +
      "Dev/e2e only, never set in production."
  );
}

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

// Takes the resolved Song rather than an id: both routes have already resolved
// it by the time they get here, and looking it up again would repeat a Cache
// API read and a full JSON parse of the lyrics for nothing.
async function buildRoundView(
  song: Song,
  foundKeys: string[],
  secret: string,
  devReveal: boolean
): Promise<RoundView> {
  const foundSet = new Set(foundKeys);
  const victory = isVictory(song, foundSet);
  const state = await signState({ songId: song.id, foundKeys: [...foundSet] }, secret);

  return {
    songId: song.id,
    state,
    title: { tokens: buildTitleView(song, foundSet, devReveal) },
    sections: buildSectionsView(song, foundSet, devReveal),
    victory,
    ...(victory ? { artist: song.artist } : {}),
  };
}

app.get("/api/round", async (c) => {
  const devReveal = c.env.DEV_REVEAL_LYRICS === "1";
  if (devReveal) announceDevReveal();
  const song = await getTodaysSong();
  return c.json(await buildRoundView(song, [], c.env.STATE_SECRET, devReveal));
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

  const devReveal = c.env.DEV_REVEAL_LYRICS === "1";
  if (devReveal) announceDevReveal();
  const view = await buildRoundView(song, newFoundKeys, c.env.STATE_SECRET, devReveal);

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

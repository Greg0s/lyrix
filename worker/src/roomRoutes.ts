import { Hono, type Context } from "hono";
import { generateRoomCode, isRoomCode } from "../../src/game/room";

/**
 * The public face of rooms (issue #29): draws codes, rate-limits, and hands
 * each request to the room's own Durable Object (room.ts), which holds its
 * members. Mounted at /api/rooms.
 *
 *   POST /api/rooms                    create a room; the creator is its host -> RoomEntry
 *   POST /api/rooms/:code/members      join one                               -> RoomEntry
 *   POST /api/rooms/:code/leave        leave it (body: { token })             -> 204
 *   POST /api/rooms/:code/guess        guess for the room's day (body: { token, word, day?, tab? }) -> RoomGuessResult
 *   POST /api/rooms/:code/alone        once the room has won, keep looking alone (body: { token, state?, day? }) -> RoundView
 *   POST /api/rooms/:code/day          take the whole room to another day's song (body: { token, day, tab? }) -> RoomRound
 *   GET  /api/rooms/:code/ws?token=&tab=  the member's live connection (WebSocket)
 */

/** The part of the Workers Rate Limiting binding used here. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** The part of a Durable Object namespace used here: one object per room code. */
export interface RoomNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): { fetch(request: Request): Promise<Response> };
}

export interface RoomsEnv {
  ROOMS: RoomNamespace;
  /** Room creations per client per minute (worker/wrangler.toml). */
  ROOM_CREATE_LIMIT: RateLimiter;
  /**
   * Join attempts per client per minute: what stands between a script and
   * every live code, since the code is all it takes to join.
   */
  ROOM_JOIN_LIMIT: RateLimiter;
}

const REQUIRED_BINDINGS = ["ROOMS", "ROOM_CREATE_LIMIT", "ROOM_JOIN_LIMIT"] as const;

/** A code is drawn again when it is already taken; with 31^6 codes, needing more than one draw is already rare. */
const MAX_CODE_DRAWS = 5;

type RoomsContext = Context<{ Bindings: RoomsEnv }>;

export const roomRoutes = new Hono<{ Bindings: RoomsEnv }>();

// Missing configuration names itself (see CLAUDE.md, "Configuration"): all
// three are declared in worker/wrangler.toml, so this only fires for a
// configuration that lost them.
roomRoutes.use("*", async (c, next) => {
  const missing = REQUIRED_BINDINGS.filter((name) => !c.env[name]);
  if (missing.length > 0) {
    console.error(
      `rooms: ${missing.join(", ")} not bound, so rooms can't be created or joined. ` +
        "They are declared in worker/wrangler.toml (and wrangler.debug.toml): run the Worker with one of those."
    );
    return c.json({ error: "server is misconfigured" }, 500);
  }
  return next();
});

function roomStub(env: RoomsEnv, code: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

function internalPost(path: string, body: unknown): Request {
  return new Request(`https://room${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Who a rate limit counts against. Behind Cloudflare that's the client's IP; `wrangler dev` has none to give. */
function clientKey(c: RoomsContext): string {
  return c.req.header("CF-Connecting-IP") ?? "local";
}

async function readBody(c: RoomsContext): Promise<Record<string, unknown>> {
  const body: unknown = await c.req.json().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

function tooManyAttempts(c: RoomsContext): Response {
  c.header("Retry-After", "60");
  return c.json({ error: "too many attempts, try again in a minute" }, 429);
}

roomRoutes.post("/", async (c) => {
  if (!(await c.env.ROOM_CREATE_LIMIT.limit({ key: clientKey(c) })).success) return tooManyAttempts(c);
  const { pseudo } = await readBody(c);

  for (let draw = 0; draw < MAX_CODE_DRAWS; draw += 1) {
    const code = generateRoomCode();
    const response = await roomStub(c.env, code).fetch(internalPost("/create", { code, pseudo }));
    if (response.status !== 409) return response;
  }
  return c.json({ error: "no free room code, try again" }, 503);
});

roomRoutes.post("/:code/members", async (c) => {
  // Counted before anything else, malformed codes included: every attempt is a guess.
  if (!(await c.env.ROOM_JOIN_LIMIT.limit({ key: clientKey(c) })).success) return tooManyAttempts(c);
  const code = c.req.param("code");
  // A code that can't exist gets the same answer as one that doesn't.
  if (!isRoomCode(code)) return c.json({ error: "no such room" }, 404);
  const { pseudo } = await readBody(c);
  return roomStub(c.env, code).fetch(internalPost("/join", { pseudo }));
});

roomRoutes.post("/:code/leave", async (c) => {
  const code = c.req.param("code");
  const { token } = await readBody(c);
  if (isRoomCode(code) && typeof token === "string" && token.length > 0) {
    await roomStub(c.env, code).fetch(internalPost("/leave", { token }));
  }
  // Same answer either way: leaving reveals nothing about which codes are live.
  return c.body(null, 204);
});

// Not rate-limited, like a solo guess: it takes a member's token, and a wrong
// one is answered exactly like a room that doesn't exist (Room.#guess).
roomRoutes.post("/:code/guess", async (c) => {
  const code = c.req.param("code");
  if (!isRoomCode(code)) return c.json({ error: "not a member of a live room" }, 404);
  const { token, word, day, tab } = await readBody(c);
  return roomStub(c.env, code).fetch(internalPost("/guess", { token, word, day, tab }));
});

// Takes the whole room to another day's song (#B). Same shape as /guess: a
// member's token, and the same 404 for a wrong one.
roomRoutes.post("/:code/day", async (c) => {
  const code = c.req.param("code");
  if (!isRoomCode(code)) return c.json({ error: "not a member of a live room" }, 404);
  const { token, day, tab } = await readBody(c);
  return roomStub(c.env, code).fetch(internalPost("/day", { token, day, tab }));
});

// Same shape as /guess: a member's token, and the same 404 for a wrong one.
roomRoutes.post("/:code/alone", async (c) => {
  const code = c.req.param("code");
  if (!isRoomCode(code)) return c.json({ error: "not a member of a live room" }, 404);
  const { token, state, day } = await readBody(c);
  return roomStub(c.env, code).fetch(internalPost("/alone", { token, state, day }));
});

// Not rate-limited: it takes a member's token, which can't be guessed, and
// its answer for a wrong one says nothing about whether the room exists
// (see Room.admit). A reconnecting phone must never be locked out by it.
roomRoutes.get("/:code/ws", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json({ error: "expected a WebSocket upgrade" }, 426);
  }
  const code = c.req.param("code");
  if (!isRoomCode(code)) return c.json({ error: "no such room" }, 404);
  const connect = new URL("https://room/connect");
  connect.searchParams.set("token", c.req.query("token") ?? "");
  const tab = c.req.query("tab");
  if (tab !== undefined) connect.searchParams.set("tab", tab);
  // The original request carries the upgrade headers the object needs.
  return roomStub(c.env, code).fetch(new Request(connect, c.req.raw));
});

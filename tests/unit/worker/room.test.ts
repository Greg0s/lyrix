import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isRoomCode,
  parseRoomEntry,
  parseRoomGuessResult,
  parseRoomMessage,
  parseRoomRoundMessage,
  ROOM_CLOSE_EXPIRED,
  ROOM_CLOSE_LEFT,
  ROOM_CLOSE_UNKNOWN,
  ROOM_PING,
  ROOM_PONG,
  type RoomEntry,
  type RoomGuessResult,
  type RoomMessage,
  type RoomRoundMessage,
} from "../../../src/game/room";
import type { DisplayToken, RoundView } from "../../../src/game/types";
import app from "../../../worker/src/index";
import { Room, type RoomContext, type RoomSocket } from "../../../worker/src/room";
import type { RateLimiter, RoomNamespace } from "../../../worker/src/roomRoutes";
import { getSongById, resetSongMemo } from "../../../worker/src/songs";
import { sealState, openState } from "../../../worker/src/state";
import { titleLeaks } from "./titleLeak";

/**
 * Rooms, end to end under plain Node: the Worker's routes in front of real
 * Room objects, each on an in-memory stand-in for its Durable Object state.
 * Only the WebSocket upgrade itself can't run here (WebSocketPair and a 101
 * response exist in the Workers runtime alone), so connections go through
 * Room.admit with a fake socket, and the e2e suite covers the real thing.
 *
 * LRCLIB answers nothing here, so every room plays songs.ts's emergency song,
 * "Le refuge de novembre": a real song, known in full, without a network.
 */

const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;
const SOCKET_CLOSED = 3;

class FakeSocket implements RoomSocket {
  readyState = 0;
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  #attachment: unknown = null;

  accept(): void {
    this.readyState = SOCKET_OPEN;
  }
  send(message: string): void {
    if (this.readyState !== SOCKET_OPEN) throw new Error("socket is not open");
    this.sent.push(message);
  }
  close(code?: number, reason?: string): void {
    if (this.readyState === SOCKET_CLOSED) throw new Error("socket is already closed");
    this.readyState = SOCKET_CLOSED;
    this.closed = { code, reason };
  }
  serializeAttachment(value: unknown): void {
    this.#attachment = structuredClone(value);
  }
  deserializeAttachment(): unknown {
    return this.#attachment;
  }

  /** Every round message received so far, parsed. */
  rounds(): RoomRoundMessage[] {
    return this.sent.flatMap((text) => {
      const message = parseRoomRoundMessage(JSON.parse(text) as unknown);
      return message ? [message] : [];
    });
  }
  lastRound(): RoomRoundMessage {
    const message = this.rounds().at(-1);
    if (!message) throw new Error("no round message received");
    return message;
  }

  /** Every room message received so far, parsed. */
  messages(): RoomMessage[] {
    return this.sent.flatMap((text) => {
      const message = parseRoomMessage(JSON.parse(text) as unknown);
      return message ? [message] : [];
    });
  }
  last(): RoomMessage {
    const message = this.messages().at(-1);
    if (!message) throw new Error("no room message received");
    return message;
  }
}

/** A Durable Object's state, in memory: storage (cloned in and out, like the real one), an alarm, and hibernatable sockets. */
class FakeState implements RoomContext {
  readonly store = new Map<string, unknown>();
  alarm: number | null = null;
  readonly sockets: { ws: RoomSocket; tags: string[] }[] = [];
  readonly storage = {
    get: async <T>(key: string): Promise<T | undefined> => structuredClone(this.store.get(key)) as T | undefined,
    put: async <T>(key: string, value: T): Promise<void> => {
      this.store.set(key, structuredClone(value));
    },
    deleteAll: async (): Promise<void> => {
      this.store.clear();
    },
    setAlarm: async (time: number): Promise<void> => {
      this.alarm = time;
    },
    deleteAlarm: async (): Promise<void> => {
      this.alarm = null;
    },
  };

  acceptWebSocket(ws: RoomSocket, tags: string[] = []): void {
    (ws as FakeSocket).readyState = SOCKET_OPEN;
    this.sockets.push({ ws, tags });
  }
  getWebSockets(tag?: string): RoomSocket[] {
    // Like the runtime, a socket stays listed until it has fully closed.
    return this.sockets
      .filter(({ ws, tags }) => ws.readyState !== SOCKET_CLOSED && (tag === undefined || tags.includes(tag)))
      .map(({ ws }) => ws);
  }
  setWebSocketAutoResponse(): void {}
}

/** The ROOMS namespace: one Room per code, each on its own state, kept across requests like the real objects. */
class FakeRooms implements RoomNamespace {
  readonly states = new Map<string, FakeState>();
  readonly requests: Request[] = [];

  idFromName(name: string): DurableObjectId {
    return { name, toString: () => name, equals: (other: DurableObjectId) => other.toString() === name };
  }
  get(id: DurableObjectId) {
    return {
      fetch: async (request: Request): Promise<Response> => {
        this.requests.push(request);
        return this.room(id.toString()).fetch(request);
      },
    };
  }
  state(code: string): FakeState {
    let state = this.states.get(code);
    if (!state) {
      state = new FakeState();
      this.states.set(code, state);
    }
    return state;
  }
  /**
   * A fresh Room object on the code's state, as after hibernation: whatever it
   * knows, it has to have read back from storage and the sockets.
   */
  room(code: string): Room {
    return new Room(this.state(code), env);
  }
}

class FakeLimiter implements RateLimiter {
  readonly keys: string[] = [];
  constructor(private readonly allowed = Number.POSITIVE_INFINITY) {}
  async limit({ key }: { key: string }): Promise<{ success: boolean }> {
    this.keys.push(key);
    return { success: this.keys.filter((seen) => seen === key).length <= this.allowed };
  }
}

let rooms: FakeRooms;
let env: {
  STATE_SECRET: string;
  ROOMS: FakeRooms;
  ROOM_CREATE_LIMIT: FakeLimiter;
  ROOM_JOIN_LIMIT: FakeLimiter;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 8, 29, 20, 0));
  // LRCLIB has nothing: every room falls back to the emergency song (see above).
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 404 })));
  resetSongMemo();
  rooms = new FakeRooms();
  env = { STATE_SECRET: "test-secret", ROOMS: rooms, ROOM_CREATE_LIMIT: new FakeLimiter(), ROOM_JOIN_LIMIT: new FakeLimiter() };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return app.request(
    path,
    { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) },
    env
  );
}

async function entryFrom(response: Response): Promise<RoomEntry> {
  expect(response.status).toBe(201);
  const entry = parseRoomEntry(await response.json());
  if (!entry) throw new Error("malformed room entry");
  return entry;
}

async function createRoom(pseudo = "Camille"): Promise<RoomEntry> {
  return entryFrom(await post("/api/rooms", { pseudo }));
}

async function joinRoom(code: string, pseudo = "Léo"): Promise<RoomEntry> {
  return entryFrom(await post(`/api/rooms/${code}/members`, { pseudo }));
}

async function connect(entry: RoomEntry): Promise<FakeSocket> {
  const socket = new FakeSocket();
  await rooms.room(entry.room.code).admit(socket, entry.token);
  return socket;
}

describe("POST /api/rooms", () => {
  it("creates a room with a fresh code, the creator as its host", async () => {
    const entry = await createRoom("Camille");

    expect(isRoomCode(entry.room.code)).toBe(true);
    expect(entry.room.host).toEqual({ id: entry.you, name: "Camille", number: 1 });
    expect(entry.room.members).toEqual([entry.room.host]);
    expect(entry.token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("expires the room at the next UTC midnight, with the day's song", async () => {
    const entry = await createRoom();

    expect(entry.room.expiresAt).toBe(Date.UTC(2026, 8, 30));
    expect(rooms.state(entry.room.code).alarm).toBe(Date.UTC(2026, 8, 30));
  });

  it("keeps an empty pseudo as unnamed, and sanitizes any other", async () => {
    expect((await createRoom("   ")).room.host.name).toBeNull();
    expect((await createRoom("  Zoé \u0000 la 🎤 Star du Karaoké ")).room.host.name).toBe("Zoé la Star du K");
  });

  it("draws another code when the first one is taken", async () => {
    const taken = await createRoom();
    const codes = [taken.room.code, "FRESH2"];
    vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      const code = codes.shift() ?? "FRESH3";
      const bytes = array as unknown as Uint8Array;
      [...code].forEach((char, index) => {
        bytes[index] = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".indexOf(char);
      });
      return array;
    });

    const entry = await createRoom("Léo");

    expect(entry.room.code).toBe("FRESH2");
    // The taken room is untouched.
    const takenState = rooms.state(taken.room.code).store.get("room") as { members: unknown[] };
    expect(takenState.members).toHaveLength(1);
  });

  it("is rate-limited per client", async () => {
    env.ROOM_CREATE_LIMIT = new FakeLimiter(1);

    expect((await post("/api/rooms", {}, { "CF-Connecting-IP": "203.0.113.7" })).status).toBe(201);
    const refused = await post("/api/rooms", {}, { "CF-Connecting-IP": "203.0.113.7" });
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("60");
    expect((await post("/api/rooms", {}, { "CF-Connecting-IP": "198.51.100.2" })).status).toBe(201);
  });
});

describe("POST /api/rooms/:code/members", () => {
  it("joins a room, as a new member numbered in arrival order", async () => {
    const host = await createRoom("Camille");
    const entry = await joinRoom(host.room.code, "Léo");

    expect(entry.room.code).toBe(host.room.code);
    expect(entry.room.host.id).toBe(host.you);
    expect(entry.you).not.toBe(host.you);
    expect(entry.room.members.find((member) => member.id === entry.you)).toEqual({
      id: entry.you,
      name: "Léo",
      number: 2,
    });
  });

  it("answers 404 for a code nobody created", async () => {
    const response = await post("/api/rooms/ZZZZZZ/members", { pseudo: "Léo" });
    expect(response.status).toBe(404);
  });

  it("answers a malformed code exactly like an unknown one", async () => {
    const response = await post("/api/rooms/abc/members", { pseudo: "Léo" });
    expect(response.status).toBe(404);
    // Turned away before any room object is even asked.
    expect(rooms.requests).toHaveLength(0);
  });

  it("answers 404 once the room has expired, even if its alarm hasn't run yet", async () => {
    const host = await createRoom();
    vi.setSystemTime(Date.UTC(2026, 8, 30, 0, 0, 1));

    expect((await post(`/api/rooms/${host.room.code}/members`, {})).status).toBe(404);
    expect(rooms.state(host.room.code).store.size).toBe(0);
  });

  // Codes can't be enumerated: every attempt counts, whatever its outcome.
  it("rate-limits every attempt, including the ones that miss", async () => {
    env.ROOM_JOIN_LIMIT = new FakeLimiter(2);
    const host = await createRoom();

    expect((await post("/api/rooms/ZZZZZZ/members", {})).status).toBe(404);
    expect((await post("/api/rooms/nope/members", {})).status).toBe(404);
    expect((await post(`/api/rooms/${host.room.code}/members`, {})).status).toBe(429);
  });
});

describe("a member's connection", () => {
  it("is taken in with the room as it stands", async () => {
    const host = await createRoom("Camille");
    const socket = await connect(host);

    expect(socket.readyState).toBe(SOCKET_OPEN);
    expect(socket.last().room.members.map((member) => member.name)).toEqual(["Camille"]);
  });

  it("tells everyone once when a new member arrives, with the member in their list", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    const guestSocket = await connect(guest);

    const heard = hostSocket.last();
    expect(heard.event).toEqual({ kind: "joined", member: { id: guest.you, name: "Léo", number: 2 } });
    expect(heard.room.members.map((member) => member.name)).toEqual(["Camille", "Léo"]);
    expect(guestSocket.last().room.members).toHaveLength(2);

    // A second connection (another tab, a reconnection) is no news.
    await connect(guest);
    expect(hostSocket.last().event).toBeUndefined();
    expect(hostSocket.messages().filter((message) => message.event?.kind === "joined")).toHaveLength(1);
  });

  it("never sends anyone's token to the others", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    await connect(guest);

    expect(hostSocket.sent.join("")).not.toContain(guest.token);
    expect(JSON.stringify(guest.room)).not.toContain(host.token);
  });

  it("is turned away the same way for a wrong token as for a room that doesn't exist", async () => {
    const host = await createRoom();
    const wrongToken = new FakeSocket();
    await rooms.room(host.room.code).admit(wrongToken, "0".repeat(32));
    const noRoom = new FakeSocket();
    await rooms.room("ZZZZZZ").admit(noRoom, host.token);

    expect(wrongToken.closed?.code).toBe(ROOM_CLOSE_UNKNOWN);
    expect(noRoom.closed?.code).toBe(ROOM_CLOSE_UNKNOWN);
    expect(rooms.state(host.room.code).getWebSockets()).toHaveLength(0);
  });

  it("drops the member from the others' lists when it closes, without a notice", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guestSocket = await connect(await joinRoom(host.room.code, "Léo"));

    guestSocket.readyState = SOCKET_CLOSING;
    await rooms.room(host.room.code).webSocketClose(guestSocket, 1001);

    expect(hostSocket.last().room.members.map((member) => member.name)).toEqual(["Camille"]);
    expect(hostSocket.last().event).toBeUndefined();
    expect(guestSocket.readyState).toBe(SOCKET_CLOSED);
  });

  it("keeps a member listed while another of their tabs is still connected", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    const firstTab = await connect(guest);
    await connect(guest);
    const before = hostSocket.sent.length;

    firstTab.readyState = SOCKET_CLOSING;
    await rooms.room(host.room.code).webSocketClose(firstTab, 1000);

    expect(hostSocket.sent).toHaveLength(before);
  });

  it("brings a reconnecting member back, after the room was evicted from memory", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    const dropped = await connect(guest);
    dropped.readyState = SOCKET_CLOSING;
    await rooms.room(host.room.code).webSocketClose(dropped, 1006);

    // Every call below builds a fresh Room on the same state, as a woken object would.
    await connect(guest);

    const heard = hostSocket.last();
    expect(heard.room.members.map((member) => member.name)).toEqual(["Camille", "Léo"]);
    expect(heard.event).toBeUndefined();
  });

  it("answers a keep-alive", async () => {
    const host = await createRoom();
    const socket = await connect(host);

    await rooms.room(host.room.code).webSocketMessage(socket, ROOM_PING);

    expect(socket.sent.at(-1)).toBe(ROOM_PONG);
  });
});

describe("POST /api/rooms/:code/leave", () => {
  it("removes the member, closes all their tabs, and tells the others by name", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    const tabs = [await connect(guest), await connect(guest)];

    const response = await post(`/api/rooms/${host.room.code}/leave`, { token: guest.token });

    expect(response.status).toBe(204);
    for (const tab of tabs) expect(tab.closed?.code).toBe(ROOM_CLOSE_LEFT);
    expect(hostSocket.last().event).toEqual({ kind: "left", member: { id: guest.you, name: "Léo", number: 2 } });
    expect(hostSocket.last().room.members.map((member) => member.name)).toEqual(["Camille"]);

    const rejoined = new FakeSocket();
    await rooms.room(host.room.code).admit(rejoined, guest.token);
    expect(rejoined.closed?.code).toBe(ROOM_CLOSE_UNKNOWN);
  });

  it("hands the host role to the earliest member left", async () => {
    const host = await createRoom("Camille");
    const second = await joinRoom(host.room.code, "Léo");
    const third = await joinRoom(host.room.code, "Inès");
    const thirdSocket = await connect(third);

    await post(`/api/rooms/${host.room.code}/leave`, { token: host.token });

    expect(thirdSocket.last().room.host.id).toBe(second.you);
  });

  it("deletes the room, pseudos included, once its last member leaves", async () => {
    const host = await createRoom("Camille");
    const state = rooms.state(host.room.code);

    await post(`/api/rooms/${host.room.code}/leave`, { token: host.token });

    expect(state.store.size).toBe(0);
    expect(state.alarm).toBeNull();
    expect((await post(`/api/rooms/${host.room.code}/members`, {})).status).toBe(404);
  });

  it("answers the same whether or not there was anything to leave", async () => {
    const host = await createRoom();

    expect((await post(`/api/rooms/${host.room.code}/leave`, { token: "nope" })).status).toBe(204);
    expect((await post("/api/rooms/ZZZZZZ/leave", { token: host.token })).status).toBe(204);
    expect((await post("/api/rooms/abc/leave", {})).status).toBe(204);
  });
});

describe("a room's expiry", () => {
  it("closes every connection and deletes everything when the alarm fires", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guestSocket = await connect(await joinRoom(host.room.code, "Léo"));
    const state = rooms.state(host.room.code);

    vi.setSystemTime(Date.UTC(2026, 8, 30));
    await rooms.room(host.room.code).alarm();

    expect(hostSocket.closed?.code).toBe(ROOM_CLOSE_EXPIRED);
    expect(guestSocket.closed?.code).toBe(ROOM_CLOSE_EXPIRED);
    expect(state.store.size).toBe(0);
  });
});

describe("GET /api/rooms/:code/ws", () => {
  it("refuses anything but a WebSocket upgrade", async () => {
    const response = await app.request("/api/rooms/ABC234/ws?token=t", {}, env);
    expect(response.status).toBe(426);
  });

  it("hands the upgrade to the room's own object, token and upgrade headers included", async () => {
    const forwarded: Request[] = [];
    const recording: RoomNamespace = {
      idFromName: (name) => rooms.idFromName(name),
      get: (id) => ({
        fetch: async (request) => {
          forwarded.push(request);
          return new Response(`room ${id.toString()}`);
        },
      }),
    };

    const response = await app.request(
      "/api/rooms/ABC234/ws?token=secret%20token",
      { headers: { Upgrade: "websocket" } },
      { ...env, ROOMS: recording }
    );

    expect(await response.text()).toBe("room ABC234");
    expect(new URL(forwarded[0].url).pathname).toBe("/connect");
    expect(new URL(forwarded[0].url).searchParams.get("token")).toBe("secret token");
    expect(forwarded[0].headers.get("Upgrade")).toBe("websocket");
  });
});

async function guessIn(entry: RoomEntry, word: string): Promise<RoomGuessResult> {
  const response = await post(`/api/rooms/${entry.room.code}/guess`, { token: entry.token, word });
  expect(response.status).toBe(200);
  const result = parseRoomGuessResult(await response.json());
  if (!result) throw new Error("malformed guess result");
  return result;
}

function words(round: RoundView): DisplayToken[] {
  return [...round.title.tokens, ...round.sections.flatMap((s) => s.lines.flatMap((l) => l.tokens))].filter(
    (token) => token.isWord
  );
}

function revealed(round: RoundView): string[] {
  return words(round)
    .filter((token) => token.revealed)
    .map((token) => token.text);
}

describe("the room's round (#30)", () => {
  it("is sent to a member as it stands when they connect", async () => {
    const host = await createRoom("Camille");
    const socket = await connect(host);

    const { round, guesses } = socket.lastRound();
    expect(guesses).toEqual([]);
    expect(round.victory).toBe(false);
    expect(revealed(round)).toEqual([]);
    expect(round.title.tokens.map((token) => token.text).join("")).toBe("__ ______ __ ________");
  });

  it("reveals a word any member finds for every member, saying who found it", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    const guestSocket = await connect(guest);

    const result = await guessIn(guest, "Refuge");

    const leo = { id: guest.you, name: "Léo", number: 2 };
    expect(result.duplicate).toBe(false);
    expect(result.guess).toMatchObject({ key: "refuge", display: "Refuge", found: true, by: leo });
    for (const socket of [hostSocket, guestSocket]) {
      const heard = socket.lastRound();
      expect(heard.latest).toBe("refuge");
      expect(heard.guesses).toEqual([result.guess]);
      expect(revealed(heard.round)).toEqual(["refuge", "refuge"]);
    }
  });

  it("shares a miss too, and counts every guess in the room", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");

    await guessIn(guest, "Refuge");
    const miss = await guessIn(host, "  guitare ");

    expect(miss.guess).toMatchObject({ key: "guitare", display: "guitare", found: false, score: null, near: [] });
    expect(hostSocket.lastRound().guesses.map((guess) => [guess.key, guess.by.name])).toEqual([
      ["guitare", "Camille"],
      ["refuge", "Léo"],
    ]);
  });

  it("says so, and changes nothing, when someone in the room already proposed the word", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    const first = await guessIn(host, "guitare");
    const heardBefore = hostSocket.sent.length;

    const again = await guessIn(guest, "Guitaré");

    expect(again.duplicate).toBe(true);
    expect(again.guess).toEqual(first.guess);
    expect(again.guesses).toHaveLength(1);
    expect(hostSocket.sent).toHaveLength(heardBefore);
  });

  it("keeps the round across the object's eviction: a reconnection catches up", async () => {
    const host = await createRoom("Camille");
    const guest = await joinRoom(host.room.code, "Léo");
    await guessIn(host, "novembre");

    // Every call builds a fresh Room on the same state, as a woken object would.
    const late = await connect(guest);

    expect(late.lastRound().guesses.map((guess) => guess.key)).toEqual(["novembre"]);
    expect(revealed(late.lastRound().round)).toContain("novembre");
  });

  it("is won for every member at once, and only then shows the rest of the lyrics", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");
    const guestSocket = await connect(guest);

    await guessIn(host, "le");
    await guessIn(guest, "refuge");
    await guessIn(host, "de");
    expect(hostSocket.lastRound().round.victory).toBe(false);
    expect(hostSocket.sent.join("")).not.toContain("jardin");

    await guessIn(guest, "novembre");

    for (const socket of [hostSocket, guestSocket]) {
      const { round } = socket.lastRound();
      expect(round.victory).toBe(true);
      expect(round.artist).toBe("Anaïs Verger");
      expect(words(round).some((token) => token.revealHint === "jardin")).toBe(true);
    }
  });

  it("never sends a still-hidden word's text before the round is won", async () => {
    const host = await createRoom("Camille");
    const socket = await connect(host);
    const result = await guessIn(host, "vent");

    const everything = socket.sent.join("") + JSON.stringify(result);
    for (const hidden of ["jardin", "feuilles", "lampe", "Verger"]) expect(everything).not.toContain(hidden);
    expect(words(result.round).some((token) => token.revealHint !== undefined || token.devHint !== undefined)).toBe(
      false
    );
  });

  // #40: a catalog id is a slug of the title, so neither it nor a readable state may reach a member.
  it("never names the song before the round is won, not even by id or in its state", async () => {
    const host = await createRoom("Camille");
    const socket = await connect(host);
    const miss = await guessIn(host, "guitare");
    const hit = await guessIn(host, "vent");

    const song = await getSongById("le-refuge-de-novembre");
    if (!song) throw new Error("the emergency song can't be resolved");
    const sent = [...socket.sent, JSON.stringify(miss), JSON.stringify(hit)].join("\n");
    expect(socket.lastRound().round.victory).toBe(false);
    expect(titleLeaks(sent, song)).toEqual([]);
  });

  it("refuses a guess the same way for a wrong token, an unknown room, and a malformed code", async () => {
    const host = await createRoom();

    const answers = await Promise.all([
      post(`/api/rooms/${host.room.code}/guess`, { token: "0".repeat(32), word: "refuge" }),
      post("/api/rooms/ZZZZZZ/guess", { token: host.token, word: "refuge" }),
      post("/api/rooms/abc/guess", { token: host.token, word: "refuge" }),
    ]);

    expect(answers.map((response) => response.status)).toEqual([404, 404, 404]);
    const bodies = await Promise.all(answers.map((response) => response.json()));
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
  });

  it("refuses an empty or overlong word", async () => {
    const host = await createRoom();
    for (const word of ["   ", "a".repeat(65), 42]) {
      expect((await post(`/api/rooms/${host.room.code}/guess`, { token: host.token, word })).status).toBe(400);
    }
  });

  it("is deleted with the room", async () => {
    const host = await createRoom("Camille");
    await guessIn(host, "refuge");
    const state = rooms.state(host.room.code);
    expect(state.store.has("round")).toBe(true);

    await post(`/api/rooms/${host.room.code}/leave`, { token: host.token });

    expect(state.store.size).toBe(0);
  });

  it("never carries over into a later room drawn with the same code", async () => {
    const state = rooms.state("ABC234");
    state.store.set("round", { songId: "leftover", guesses: [{ key: "refuge" }] });

    const response = await rooms.room("ABC234").fetch(
      new Request("https://room/create", { method: "POST", body: JSON.stringify({ code: "ABC234", pseudo: "Zoé" }) })
    );
    const entry = await entryFrom(response);
    const socket = await connect(entry);

    expect(socket.lastRound().guesses).toEqual([]);
  });
});

async function winTogether(host: RoomEntry, guest: RoomEntry): Promise<void> {
  await guessIn(host, "le");
  await guessIn(guest, "refuge");
  await guessIn(host, "de");
  await guessIn(guest, "novembre");
}

async function alone(entry: RoomEntry, state?: string): Promise<Response> {
  return post(`/api/rooms/${entry.room.code}/alone`, { token: entry.token, state });
}

describe("keeping looking alone once the group has won", () => {
  it("names the guess that completed the title, for everyone, and only from then on", async () => {
    const host = await createRoom("Camille");
    const hostSocket = await connect(host);
    const guest = await joinRoom(host.room.code, "Léo");

    await guessIn(host, "vent");
    expect(hostSocket.lastRound().winningKey).toBeUndefined();
    await winTogether(host, guest);
    await guessIn(host, "jardin");

    expect(hostSocket.lastRound().winningKey).toBe("novembre");
    expect((await connect(guest)).lastRound().winningKey).toBe("novembre");
  });

  it("is refused before the group has won", async () => {
    const host = await createRoom();
    await guessIn(host, "refuge");

    expect((await alone(host)).status).toBe(409);
  });

  it("is refused the same way as a guess for anyone who isn't a member", async () => {
    const host = await createRoom();
    const wrong = await post(`/api/rooms/${host.room.code}/alone`, { token: "0".repeat(32) });
    const guess = await post(`/api/rooms/${host.room.code}/guess`, { token: "0".repeat(32), word: "x" });

    expect(wrong.status).toBe(404);
    expect(await wrong.json()).toEqual(await guess.json());
  });

  it("signs a solo round holding the group's finds but the winning word, without the answer", async () => {
    const host = await createRoom("Camille");
    const guest = await joinRoom(host.room.code, "Léo");
    await guessIn(host, "vent");
    await winTogether(host, guest);

    const response = await alone(host);
    expect(response.status).toBe(200);
    const view = (await response.json()) as RoundView;

    expect(view.victory).toBe(false);
    expect(view.artist).toBeUndefined();
    expect(revealed(view)).not.toContain("novembre");
    expect(revealed(view)).toEqual(expect.arrayContaining(["Le", "refuge", "de", "vent"]));
    expect(words(view).some((token) => token.revealHint !== undefined)).toBe(false);
    const payload = await openState(view.state, env.STATE_SECRET);
    expect(new Set(payload?.foundKeys)).toEqual(new Set(["le", "refuge", "de", "vent"]));
  });

  it("keeps the player's own solo finds, and only a genuine state of the same song", async () => {
    const host = await createRoom("Camille");
    const guest = await joinRoom(host.room.code, "Léo");
    await winTogether(host, guest);
    const songId = (await openState((await connect(host)).lastRound().round.state, env.STATE_SECRET))?.songId;
    if (!songId) throw new Error("the room's round state does not open");

    const own = await sealState({ songId, foundKeys: ["jardin"] }, env.STATE_SECRET);
    const otherSong = await sealState({ songId: "another-song", foundKeys: ["lampe"] }, env.STATE_SECRET);
    const forged = await sealState({ songId, foundKeys: ["maison"] }, "not-the-secret");

    const keys = async (state: string) =>
      (await openState(((await (await alone(guest, state)).json()) as RoundView).state, env.STATE_SECRET))
        ?.foundKeys ?? [];
    expect(await keys(own)).toContain("jardin");
    expect(await keys(otherSong)).not.toContain("lampe");
    expect(await keys(forged)).not.toContain("maison");
  });

  it("hands over a round the solo route plays on: finding the winning word wins it", async () => {
    const host = await createRoom("Camille");
    const guest = await joinRoom(host.room.code, "Léo");
    await winTogether(host, guest);
    const view = (await (await alone(host)).json()) as RoundView;

    const response = await post("/api/guess", { state: view.state, word: "novembre" });

    expect(((await response.json()) as RoundView).victory).toBe(true);
  });
});

describe("a Worker missing the room bindings", () => {
  it("names what is missing instead of failing somewhere deeper", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await app.request("/api/rooms", { method: "POST", body: "{}" }, { STATE_SECRET: "test-secret" });

    expect(response.status).toBe(500);
    expect(log.mock.calls[0]?.[0]).toContain("ROOMS, ROOM_CREATE_LIMIT, ROOM_JOIN_LIMIT");
  });
});

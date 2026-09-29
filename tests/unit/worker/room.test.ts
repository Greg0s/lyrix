import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isRoomCode,
  parseRoomEntry,
  parseRoomMessage,
  ROOM_CLOSE_EXPIRED,
  ROOM_CLOSE_LEFT,
  ROOM_CLOSE_UNKNOWN,
  ROOM_PING,
  ROOM_PONG,
  type RoomEntry,
  type RoomMessage,
} from "../../../src/game/room";
import app from "../../../worker/src/index";
import { Room, type RoomContext, type RoomSocket } from "../../../worker/src/room";
import type { RateLimiter, RoomNamespace } from "../../../worker/src/roomRoutes";

/**
 * Rooms, end to end under plain Node: the Worker's routes in front of real
 * Room objects, each on an in-memory stand-in for its Durable Object state.
 * Only the WebSocket upgrade itself can't run here (WebSocketPair and a 101
 * response exist in the Workers runtime alone), so connections go through
 * Room.admit with a fake socket, and the e2e suite covers the real thing.
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
    return new Room(this.state(code));
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
  rooms = new FakeRooms();
  env = { STATE_SECRET: "test-secret", ROOMS: rooms, ROOM_CREATE_LIMIT: new FakeLimiter(), ROOM_JOIN_LIMIT: new FakeLimiter() };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

describe("a Worker missing the room bindings", () => {
  it("names what is missing instead of failing somewhere deeper", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await app.request("/api/rooms", { method: "POST", body: "{}" }, { STATE_SECRET: "test-secret" });

    expect(response.status).toBe(500);
    expect(log.mock.calls[0]?.[0]).toContain("ROOMS, ROOM_CREATE_LIMIT, ROOM_JOIN_LIMIT");
  });
});

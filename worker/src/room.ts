import {
  isRoomCode,
  roomExpiresAt,
  ROOM_CLOSE_EXPIRED,
  ROOM_CLOSE_LEFT,
  ROOM_CLOSE_UNKNOWN,
  ROOM_PING,
  ROOM_PONG,
  sanitizePseudo,
  type RoomEntry,
  type RoomEvent,
  type RoomMember,
  type RoomMessage,
  type RoomSnapshot,
} from "../../src/game/room";

/**
 * One room ("salon", issue #29) per Durable Object, addressed by its code
 * (`idFromName(code)`). The Worker routes (roomRoutes.ts) issue codes,
 * rate-limit, and forward to it; everything about who is in the room lives
 * here, and only here.
 *
 * Members connect over WebSockets through the hibernation API, so an idle room
 * costs nothing: the object is evicted between messages, and rebuilds what it
 * needs from storage and from the sockets' attachments when it wakes.
 *
 * Retention: a pseudo is kept in this object's storage for as long as its
 * member is in the room, and nowhere else. Everything is deleted when the
 * room expires (the next UTC midnight, with the day's song) or when its last
 * member leaves. Nothing about a member is logged.
 */

/** A member as the room stores it: the public part, plus what never leaves in a snapshot. */
interface MemberRecord extends RoomMember {
  /** Proves membership on (re)connection. Only ever sent to its own member. */
  token: string;
  /** Whether everyone has been told this member arrived: once, on their first connection. */
  announced: boolean;
}

interface RoomRecord {
  code: string;
  expiresAt: number;
  hostId: string;
  nextNumber: number;
  /** In arrival order. */
  members: MemberRecord[];
}

interface SocketAttachment {
  memberId: string;
}

/** The part of a hibernatable WebSocket the room uses: a real one in production, a fake in the unit tests. */
export interface RoomSocket {
  readonly readyState: number;
  accept(): void;
  send(message: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

/** The part of DurableObjectState the room uses. */
export interface RoomContext {
  readonly storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    deleteAll(): Promise<void>;
    setAlarm(scheduledTime: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
  acceptWebSocket(ws: RoomSocket, tags?: string[]): void;
  getWebSockets(tag?: string): RoomSocket[];
  setWebSocketAutoResponse(pair?: WebSocketRequestResponsePair): void;
}

const STORAGE_KEY = "room";
/** WebSocket.OPEN, which plain Node (the unit tests) has no global for. */
const SOCKET_OPEN = 1;
/** Close codes a server may not send itself; a close is answered with a plain 1000 instead. */
const RESERVED_CLOSE_CODES = new Set([1005, 1006, 1015]);

function randomHex(byteCount: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteCount)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function publicMember({ id, name, number }: MemberRecord): RoomMember {
  return { id, name, number };
}

function newMember(number: number, pseudo: unknown): MemberRecord {
  const name = typeof pseudo === "string" ? sanitizePseudo(pseudo) : "";
  return { id: randomHex(8), token: randomHex(16), name: name || null, number, announced: false };
}

function attachedMemberId(ws: RoomSocket): string | null {
  const attachment = ws.deserializeAttachment() as Partial<SocketAttachment> | null;
  return typeof attachment?.memberId === "string" ? attachment.memberId : null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

export class Room {
  // undefined until read from storage; null once known not to exist.
  #room: RoomRecord | null | undefined;

  constructor(private readonly ctx: RoomContext) {
    // Keep-alives are answered by the runtime without waking the object.
    // Only defined in the Workers runtime; the unit tests answer them in
    // webSocketMessage instead.
    if (typeof WebSocketRequestResponsePair === "function") {
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(ROOM_PING, ROOM_PONG));
    }
  }

  /** Internal API, reached only through the Worker's routes (roomRoutes.ts), never from the internet directly. */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    if (route === "GET /connect") return this.#connect(url.searchParams.get("token"));
    if (route === "POST /create") return this.#create(await readBody(request));
    if (route === "POST /join") return this.#join(await readBody(request));
    if (route === "POST /leave") return this.#leave(await readBody(request));
    return json({ error: "not found" }, 404);
  }

  async #create({ code, pseudo }: Record<string, unknown>): Promise<Response> {
    if (typeof code !== "string" || !isRoomCode(code)) return json({ error: "invalid room code" }, 400);
    // The Worker draws the code at random; on the rare collision it draws again.
    if (await this.#load()) return json({ error: "room code already in use" }, 409);

    // The creator is there from the start: nobody is around to be told they arrived.
    const host = { ...newMember(1, pseudo), announced: true };
    const room: RoomRecord = {
      code,
      expiresAt: roomExpiresAt(Date.now()),
      hostId: host.id,
      nextNumber: 2,
      members: [host],
    };
    await this.#save(room);
    await this.ctx.storage.setAlarm(room.expiresAt);
    return json(this.#entry(room, host), 201);
  }

  async #join({ pseudo }: Record<string, unknown>): Promise<Response> {
    const room = await this.#load();
    if (!room) return json({ error: "no such room" }, 404);

    const member = newMember(room.nextNumber, pseudo);
    room.nextNumber += 1;
    room.members.push(member);
    await this.#save(room);
    // Everyone else hears about the new member once they connect (admit), so
    // the notice and the member showing up in their list arrive together.
    return json(this.#entry(room, member), 201);
  }

  async #leave({ token }: Record<string, unknown>): Promise<Response> {
    const room = await this.#load();
    const member = room && typeof token === "string" ? room.members.find((m) => m.token === token) : undefined;
    // Same answer whether or not there was anything to leave: no oracle on which codes are live.
    if (!room || !member) return new Response(null, { status: 204 });

    room.members = room.members.filter((m) => m !== member);
    // Every tab the member had open: they left the room, not just this one.
    for (const ws of this.ctx.getWebSockets(member.id)) {
      try {
        ws.close(ROOM_CLOSE_LEFT, "left the room");
      } catch {
        // Already closing.
      }
    }

    if (room.members.length === 0) {
      await this.#destroy();
      return new Response(null, { status: 204 });
    }
    if (room.hostId === member.id) room.hostId = room.members[0].id;
    await this.#save(room);
    this.#broadcast(room, { kind: "left", member: publicMember(member) });
    return new Response(null, { status: 204 });
  }

  async #connect(token: string | null): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair());
    // The server end has to be accepted (or turned away) before the upgrade
    // is answered; what admit sends it meanwhile is queued for the client.
    await this.admit(server, token);
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Takes a new connection in, or turns it away. Separate from the upgrade
   * itself only because WebSocketPair exists in the Workers runtime alone:
   * the unit tests hand it a fake socket.
   *
   * A connection is turned away with ROOM_CLOSE_UNKNOWN whether the room is
   * gone or the token isn't a member's: telling those apart would let anyone
   * probe for live codes without going through the rate-limited join.
   */
  async admit(socket: RoomSocket, token: string | null): Promise<void> {
    const room = await this.#load();
    const member = room && token ? room.members.find((m) => m.token === token) : undefined;
    if (!room || !member) {
      socket.accept();
      socket.close(ROOM_CLOSE_UNKNOWN, "not a member of a live room");
      return;
    }

    this.ctx.acceptWebSocket(socket, [member.id]);
    socket.serializeAttachment({ memberId: member.id } satisfies SocketAttachment);
    let event: RoomEvent | undefined;
    if (!member.announced) {
      member.announced = true;
      await this.#save(room);
      event = { kind: "joined", member: publicMember(member) };
    }
    // Everyone, the new socket included: a reconnecting member reappears in
    // the others' lists, and gets the room as it stands now.
    this.#broadcast(room, event);
  }

  async webSocketMessage(ws: RoomSocket, message: string | ArrayBuffer): Promise<void> {
    // In production the runtime answers keep-alives before they get here.
    if (message === ROOM_PING) ws.send(ROOM_PONG);
  }

  async webSocketClose(ws: RoomSocket, code: number): Promise<void> {
    try {
      ws.close(RESERVED_CLOSE_CODES.has(code) ? 1000 : code, "closed");
    } catch {
      // Already closed on this side.
    }
    await this.#dropped(ws);
  }

  async webSocketError(ws: RoomSocket): Promise<void> {
    await this.#dropped(ws);
  }

  /** The room's expiry: the day's song changed. */
  async alarm(): Promise<void> {
    await this.#expire();
  }

  async #dropped(ws: RoomSocket): Promise<void> {
    const memberId = attachedMemberId(ws);
    const room = await this.#load();
    if (!room || !memberId) return;
    // Left: everyone was already told, with the member's name.
    if (!room.members.some((m) => m.id === memberId)) return;
    // Still there from another tab.
    if (this.#online(ws).has(memberId)) return;
    // Out of the others' lists until they reconnect; no notice, since a
    // dropped phone connection isn't a goodbye.
    this.#broadcast(room, undefined, ws);
  }

  async #load(): Promise<RoomRecord | null> {
    if (this.#room === undefined) this.#room = (await this.ctx.storage.get<RoomRecord>(STORAGE_KEY)) ?? null;
    // The alarm can run late; a room is never served past its expiry.
    if (this.#room && Date.now() >= this.#room.expiresAt) await this.#expire();
    return this.#room;
  }

  async #save(room: RoomRecord): Promise<void> {
    this.#room = room;
    await this.ctx.storage.put(STORAGE_KEY, room);
  }

  async #expire(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(ROOM_CLOSE_EXPIRED, "room expired");
      } catch {
        // Already closing.
      }
    }
    await this.#destroy();
  }

  async #destroy(): Promise<void> {
    this.#room = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  #openSockets(except?: RoomSocket): RoomSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === SOCKET_OPEN);
  }

  /** Ids of the members with at least one open connection. */
  #online(except?: RoomSocket): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.#openSockets(except)) {
      const memberId = attachedMemberId(ws);
      if (memberId) ids.add(memberId);
    }
    return ids;
  }

  #snapshot(room: RoomRecord, online: ReadonlySet<string>): RoomSnapshot {
    const host = room.members.find((m) => m.id === room.hostId) ?? room.members[0];
    return {
      code: room.code,
      host: publicMember(host),
      members: room.members.filter((m) => online.has(m.id)).map(publicMember),
      expiresAt: room.expiresAt,
    };
  }

  /** What creating or joining answers. The new member counts as there already: their socket is on its way. */
  #entry(room: RoomRecord, member: MemberRecord): RoomEntry {
    const online = this.#online();
    online.add(member.id);
    return { you: member.id, token: member.token, room: this.#snapshot(room, online) };
  }

  #broadcast(room: RoomRecord, event?: RoomEvent, except?: RoomSocket): void {
    const message: RoomMessage = { type: "room", room: this.#snapshot(room, this.#online(except)) };
    if (event) message.event = event;
    const text = JSON.stringify(message);
    for (const ws of this.#openSockets(except)) {
      try {
        ws.send(text);
      } catch {
        // Closing under us: its own close event will follow.
      }
    }
  }
}

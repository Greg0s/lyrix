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
  type RoomGuess,
  type RoomGuessResult,
  type RoomMember,
  type RoomMessage,
  type RoomRound,
  type RoomRoundMessage,
  type RoomSnapshot,
} from "../../src/game/room";
import { isVictory } from "../../src/game/mask";
import type { RoundView, Song } from "../../src/game/types";
import { buildRoundView, evaluateGuess, MAX_WORD_LENGTH, parseGuessWord, type RoundEnv } from "./round";
import { getSongById, getTodaysSong } from "./songs";
import { verifyState } from "./state";

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
 * It also holds the room's round (issue #30): the day's song, pinned when the
 * room first needs it, and every guess its members made. Found words live
 * here and nowhere else - a member only ever sends a word - and every member
 * is sent the same masked view, built from them.
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

/** The room's round, stored apart from its members: a guess never rewrites the member list. */
interface RoundRecord {
  songId: string;
  /** Newest first. */
  guesses: RoomGuess[];
  /** The guess that completed the title, once one has. */
  winningKey?: string;
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
const ROUND_STORAGE_KEY = "round";
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

function foundKeys(round: RoundRecord): Set<string> {
  return new Set(round.guesses.filter((guess) => guess.found).map((guess) => guess.key));
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
  // undefined until read from storage; null when the room hasn't needed one yet.
  #round: RoundRecord | null | undefined;

  constructor(
    private readonly ctx: RoomContext,
    private readonly env: RoundEnv
  ) {
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
    if (route === "POST /guess") return this.#guess(await readBody(request));
    if (route === "POST /alone") return this.#alone(await readBody(request));
    return json({ error: "not found" }, 404);
  }

  async #create({ code, pseudo }: Record<string, unknown>): Promise<Response> {
    if (typeof code !== "string" || !isRoomCode(code)) return json({ error: "invalid room code" }, 400);
    // The Worker draws the code at random; on the rare collision it draws again.
    if (await this.#load()) return json({ error: "room code already in use" }, 409);

    // Nothing left over from an earlier room with this code (a round written
    // while that one was being deleted) may carry over into this one.
    this.#round = null;
    await this.ctx.storage.deleteAll();

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
    // And the round as it stands, to the new socket alone: whatever it missed
    // while away, a (re)connection catches up on in one message.
    const message = await this.#roundMessage().catch(() => null);
    if (message) {
      try {
        socket.send(JSON.stringify(message));
      } catch {
        // Closed while the song was being resolved: its close event follows.
      }
    }
  }

  /**
   * A member's guess, for the whole room. Answered like the room doesn't exist
   * for a token that isn't a member's (see admit). A word someone already
   * proposed changes nothing and says so; any other is checked against the
   * room's song, kept, and sent to every member with the room's new view.
   */
  async #guess({ token, word }: Record<string, unknown>): Promise<Response> {
    const room = await this.#load();
    const member = room && typeof token === "string" ? room.members.find((m) => m.token === token) : undefined;
    if (!room || !member) return json({ error: "not a member of a live room" }, 404);
    const trimmed = parseGuessWord(word);
    if (trimmed === null) return json({ error: `word must be between 1 and ${MAX_WORD_LENGTH} characters` }, 400);

    let loaded: { round: RoundRecord; song: Song };
    try {
      loaded = await this.#loadRound();
    } catch {
      return json({ error: "the song is unavailable, try again" }, 503);
    }
    const { round, song } = loaded;
    const outcome = await evaluateGuess(this.env, song, foundKeys(round), trimmed);

    // Checked only now, with nothing awaited between here and the write below:
    // the song and the similarity table are awaited above, and another guess
    // of the same word could have landed meanwhile.
    const earlier = round.guesses.find((guess) => guess.key === outcome.key);
    if (earlier) {
      const result: RoomGuessResult = { ...(await this.#roundOf(round, song)), guess: earlier, duplicate: true };
      return json(result, 200);
    }

    const guess: RoomGuess = { ...outcome, display: trimmed, by: publicMember(member) };
    const wonBefore = isVictory(song, foundKeys(round));
    round.guesses.unshift(guess);
    if (!wonBefore && isVictory(song, foundKeys(round))) round.winningKey = guess.key;
    await this.ctx.storage.put(ROUND_STORAGE_KEY, round);

    const current = await this.#roundOf(round, song);
    const message: RoomRoundMessage = { type: "round", ...current, latest: guess.key };
    this.#send(JSON.stringify(message));
    const result: RoomGuessResult = { ...current, guess, duplicate: false };
    return json(result, 200);
  }

  /**
   * Once the group has found the song, a member who didn't complete the title
   * can keep looking on their own: this signs them a solo round holding
   * everything the group found except the winning word, plus whatever their
   * own solo round (`state`, verified here) had found. Refused before the
   * group has won: until then, the room's own view is all there is.
   */
  async #alone({ token, state }: Record<string, unknown>): Promise<Response> {
    const room = await this.#load();
    const member = room && typeof token === "string" ? room.members.find((m) => m.token === token) : undefined;
    if (!room || !member) return json({ error: "not a member of a live room" }, 404);

    let loaded: { round: RoundRecord; song: Song };
    try {
      loaded = await this.#loadRound();
    } catch {
      return json({ error: "the song is unavailable, try again" }, 503);
    }
    const { round, song } = loaded;
    const { winningKey } = round;
    if (winningKey === undefined) return json({ error: "the room hasn't found the song yet" }, 409);

    const keys = foundKeys(round);
    keys.delete(winningKey);
    const own = typeof state === "string" ? await verifyState(state, this.env.STATE_SECRET) : null;
    // Only the player's own progress on this same song: a found word of theirs
    // is theirs to keep, the winning one included.
    if (own && own.songId === song.id) for (const key of own.foundKeys) keys.add(key);
    const view: RoundView = await buildRoundView(song, keys, this.env);
    return json(view, 200);
  }

  /** The room's round, pinned to today's song the first time it is needed. */
  async #loadRound(): Promise<{ round: RoundRecord; song: Song }> {
    if (this.#round === undefined) this.#round = (await this.ctx.storage.get<RoundRecord>(ROUND_STORAGE_KEY)) ?? null;
    if (!this.#round) {
      const today = await getTodaysSong();
      // Another request may have pinned it while the song was being resolved.
      if (!this.#round) {
        this.#round = { songId: today.id, guesses: [] };
        await this.ctx.storage.put(ROUND_STORAGE_KEY, this.#round);
      }
    }
    const round: RoundRecord = this.#round;
    // Memoized per isolate (songs.ts): after the first guess, this costs nothing.
    const song = await getSongById(round.songId);
    if (!song) throw new Error("the room's song can't be resolved");
    return { round, song };
  }

  async #roundOf(round: RoundRecord, song: Song): Promise<RoomRound> {
    return {
      round: await buildRoundView(song, foundKeys(round), this.env),
      guesses: round.guesses,
      ...(round.winningKey !== undefined ? { winningKey: round.winningKey } : {}),
    };
  }

  async #roundMessage(): Promise<RoomRoundMessage> {
    const { round, song } = await this.#loadRound();
    return { type: "round", ...(await this.#roundOf(round, song)) };
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
    this.#round = null;
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
    this.#send(JSON.stringify(message), except);
  }

  #send(text: string, except?: RoomSocket): void {
    for (const ws of this.#openSockets(except)) {
      try {
        ws.send(text);
      } catch {
        // Closing under us: its own close event will follow.
      }
    }
  }
}

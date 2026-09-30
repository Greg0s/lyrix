import { msUntilNextSong } from "./daily";
import { parseNearSlots } from "./slots";
import type { NearSlot, RoundView } from "./types";

/**
 * Rooms ("salons", issue #29): a group of players looking for the day's song
 * together. The Worker issues the codes and holds who is in each room (one
 * Durable Object per room, worker/src/room.ts); the frontend validates what
 * the player types and draws the members. Both halves of the contract live
 * here, so they can only disagree by editing one file.
 *
 * A room also plays the day's round together (issue #30): its object holds
 * the room's guesses, found words included, and builds the one masked view
 * every member sees. The found words live there and only there - a member
 * sends a word, never a list of what they think is found.
 */

/** No 0/O, 1/I/L: a code read aloud or copied off a screen can't be misread. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const PSEUDO_MAX_LENGTH = 16;
/** How the local player is named when they left "Ton pseudo" empty. */
export const OWN_FALLBACK_NAME = "Toi";

/**
 * WebSocket close codes the room's server side uses, so the client can tell
 * "stop, you are no longer in a room" from a dropped connection worth retrying.
 * The same one is used whether the room doesn't exist or the token isn't a
 * member's: telling those apart would let anyone probe which codes are live
 * without going through the rate-limited join.
 */
export const ROOM_CLOSE_UNKNOWN = 4404;
/** The room reached its expiry (the next UTC midnight, with the day's song). */
export const ROOM_CLOSE_EXPIRED = 4410;
/** The member left the room, possibly from another tab. */
export const ROOM_CLOSE_LEFT = 4001;

/** Keep-alive: answered by the runtime itself (setWebSocketAutoResponse), without waking the room. */
export const ROOM_PING = "ping";
export const ROOM_PONG = "pong";

export interface RoomMember {
  /** Public and stable for as long as the player stays in the room. */
  id: string;
  /** Sanitized pseudo; null when the player left it empty. */
  name: string | null;
  /** Arrival order, from 1 for the creator: names an unnamed player, and picks their colour. */
  number: number;
}

export interface RoomSnapshot {
  code: string;
  host: RoomMember;
  /** Members with a live connection, in arrival order. */
  members: RoomMember[];
  /** Epoch ms of the next UTC midnight after the room was created: the room ends with the day's song. */
  expiresAt: number;
}

/** What creating or joining a room answers. */
export interface RoomEntry {
  /** The member id the player has in this room. */
  you: string;
  /** Proves membership when (re)connecting. Only ever sent to its own member. */
  token: string;
  room: RoomSnapshot;
}

export interface RoomEvent {
  kind: "joined" | "left";
  member: RoomMember;
}

/** Every message the room's WebSocket sends: the room as it now stands, and what changed, when worth telling. */
export interface RoomMessage {
  type: "room";
  room: RoomSnapshot;
  event?: RoomEvent;
}

/** A guess made in a room: who made it, and what it gave. Everyone in the room sees it. */
export interface RoomGuess {
  /** Normalized, as the round compares words: one guess per key, per room. */
  key: string;
  /** As its player typed it. */
  display: string;
  found: boolean;
  /** Semantic proximity, 0-100; null when unscored (see GuessResult.score). */
  score: number | null;
  /** The hidden words it is close to, by position (see GuessResult.near). */
  near: NearSlot[];
  /** Kept with the guess, so its colour and name outlive the player leaving. */
  by: RoomMember;
}

/**
 * The room's round as it stands: the masked view everyone sees and every
 * guess made so far, newest first. A room's guesses only ever grow, so how
 * many there are orders two of these that arrived out of order.
 */
export interface RoomRound {
  round: RoundView;
  guesses: RoomGuess[];
  /**
   * Once the group has found the song: the key of the guess that completed the
   * title. Its player found it; everyone else is offered the answer or to keep
   * looking on their own (POST /api/rooms/:code/alone).
   */
  winningKey?: string;
}

/** Sent to a member on (re)connection, and to everyone after each new guess. */
export interface RoomRoundMessage extends RoomRound {
  type: "round";
  /** The key of the guess this message announces; absent on a (re)connection. */
  latest?: string;
}

/** What POST /api/rooms/:code/guess answers. */
export interface RoomGuessResult extends RoomRound {
  /** The guess the word made, or the one made before when it was already proposed. */
  guess: RoomGuess;
  /** True when someone in the room had already proposed the word: nothing changed. */
  duplicate: boolean;
}

/** What the player typed, as a code: whitespace dropped, uppercased, capped at the code's length. */
export function normalizeRoomCodeInput(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase().slice(0, ROOM_CODE_LENGTH);
}

/** Strict: exactly ROOM_CODE_LENGTH characters of the alphabet, nothing normalized. */
export function isRoomCode(value: string): boolean {
  if (value.length !== ROOM_CODE_LENGTH) return false;
  for (const char of value) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Invite links: `/salon/<code>`. Opening one offers to join that room, the
 * code already typed in; nothing is asked of the server until the player
 * confirms, so the link goes through the same rate-limited join as a typed
 * code. The path is served its own page, whose link preview says it is an
 * invitation (scripts/lib/invitePage.ts), and that page never looks the code
 * up: a preview must read the same for a live code as for a dead one.
 */
export const INVITE_PATH = "/salon/";

/** The link that invites a player into this room, on the site at `origin`. */
export function inviteUrl(code: string, origin: string): string {
  return new URL(`${INVITE_PATH}${code}`, origin).toString();
}

/**
 * The room code an invite link carries, if `pathname` is one. Forgiving about
 * case and a trailing slash (a code retyped from a chat); null for any other
 * path, and for a code that can't exist.
 */
export function parseInvitePath(pathname: string): string | null {
  if (!pathname.startsWith(INVITE_PATH)) return null;
  const code = pathname.slice(INVITE_PATH.length).replace(/\/$/, "").toUpperCase();
  return isRoomCode(code) ? code : null;
}

function cryptoBytes(count: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(count));
}

// The largest multiple of the alphabet's size a byte can hold: a byte at or
// above it is drawn again, so every character is exactly as likely.
const UNBIASED_BYTE_LIMIT = 256 - (256 % ROOM_CODE_ALPHABET.length);

/** A fresh random code. `randomBytes` is only there for tests. */
export function generateRoomCode(randomBytes: (count: number) => Uint8Array = cryptoBytes): string {
  let code = "";
  while (code.length < ROOM_CODE_LENGTH) {
    for (const byte of randomBytes(ROOM_CODE_LENGTH)) {
      if (byte >= UNBIASED_BYTE_LIMIT) continue;
      code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }
  return code;
}

/**
 * A pseudo as everyone else will see it: NFC, letters, digits, spaces and
 * `' ’ - _ .` only, runs of whitespace collapsed, at most PSEUDO_MAX_LENGTH
 * characters. Everything else goes, in particular control and invisible
 * characters, bidi overrides, emoji, and combining marks (which is what
 * stacks "zalgo" text over the rest of the page). Empty means unnamed.
 */
export function sanitizePseudo(raw: string): string {
  const kept = raw
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(/[^\p{L}\p{N} '’\-_.]/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();
  return Array.from(kept).slice(0, PSEUDO_MAX_LENGTH).join("").trim();
}

/** A member's display name: their pseudo, else "Toi" for the local player and "Joueur N" for anyone else. */
export function memberName(member: RoomMember, you: string | null): string {
  if (member.name) return member.name;
  return member.id === you ? OWN_FALLBACK_NAME : `Joueur ${member.number}`;
}

/** French: 0 and 1 take the singular. */
export function playerCountLabel(count: number): string {
  return `${count} ${count < 2 ? "joueur" : "joueurs"}`;
}

/** When a room created at `nowMs` expires: the next UTC midnight, when the day's song changes. */
export function roomExpiresAt(nowMs: number): number {
  return nowMs + msUntilNextSong(nowMs);
}

// ---------- Parsing what comes off the network or out of storage ----------
// Never trusted: a malformed value is rejected, never thrown on.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRoomMember(value: unknown): RoomMember | null {
  if (!isRecord(value)) return null;
  const { id, name, number } = value;
  if (typeof id !== "string" || id.length === 0) return null;
  if (name !== null && typeof name !== "string") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) return null;
  return { id, name: name || null, number };
}

export function parseRoomSnapshot(value: unknown): RoomSnapshot | null {
  if (!isRecord(value)) return null;
  const { code, host, members, expiresAt } = value;
  if (typeof code !== "string" || !isRoomCode(code)) return null;
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return null;
  const parsedHost = parseRoomMember(host);
  if (!parsedHost || !Array.isArray(members)) return null;
  const parsedMembers: RoomMember[] = [];
  for (const entry of members) {
    const member = parseRoomMember(entry);
    if (!member) return null;
    parsedMembers.push(member);
  }
  return { code, host: parsedHost, members: parsedMembers, expiresAt };
}

export function parseRoomEntry(value: unknown): RoomEntry | null {
  if (!isRecord(value)) return null;
  const { you, token } = value;
  if (typeof you !== "string" || typeof token !== "string" || token.length === 0) return null;
  const room = parseRoomSnapshot(value.room);
  return room ? { you, token, room } : null;
}

export function parseRoomMessage(value: unknown): RoomMessage | null {
  if (!isRecord(value) || value.type !== "room") return null;
  const room = parseRoomSnapshot(value.room);
  if (!room) return null;
  if (value.event === undefined) return { type: "room", room };
  if (!isRecord(value.event)) return null;
  const { kind } = value.event;
  const member = parseRoomMember(value.event.member);
  if ((kind !== "joined" && kind !== "left") || !member) return null;
  return { type: "room", room, event: { kind, member } };
}

/** A light structural check: a RoundView is always built by the Worker, this only guards against garbage. */
export function isRoundView(value: unknown): value is RoundView {
  if (!isRecord(value)) return false;
  return (
    typeof value.state === "string" &&
    typeof value.victory === "boolean" &&
    isRecord(value.title) &&
    Array.isArray(value.title.tokens) &&
    Array.isArray(value.sections)
  );
}

export function parseRoomGuess(value: unknown): RoomGuess | null {
  if (!isRecord(value)) return null;
  const { key, display, found, score } = value;
  if (typeof key !== "string" || typeof display !== "string" || typeof found !== "boolean") return null;
  const by = parseRoomMember(value.by);
  if (!by) return null;
  return {
    key,
    display,
    found,
    score: typeof score === "number" && Number.isFinite(score) ? score : null,
    near: parseNearSlots(value.near),
    by,
  };
}

function parseRoomRound(value: Record<string, unknown>): RoomRound | null {
  if (!isRoundView(value.round) || !Array.isArray(value.guesses)) return null;
  const guesses: RoomGuess[] = [];
  for (const entry of value.guesses) {
    const guess = parseRoomGuess(entry);
    if (!guess) return null;
    guesses.push(guess);
  }
  return typeof value.winningKey === "string"
    ? { round: value.round, guesses, winningKey: value.winningKey }
    : { round: value.round, guesses };
}

export function parseRoomRoundMessage(value: unknown): RoomRoundMessage | null {
  if (!isRecord(value) || value.type !== "round") return null;
  const parsed = parseRoomRound(value);
  if (!parsed) return null;
  return typeof value.latest === "string" ? { type: "round", ...parsed, latest: value.latest } : { type: "round", ...parsed };
}

export function parseRoomGuessResult(value: unknown): RoomGuessResult | null {
  if (!isRecord(value) || typeof value.duplicate !== "boolean") return null;
  const parsed = parseRoomRound(value);
  const guess = parseRoomGuess(value.guess);
  return parsed && guess ? { ...parsed, guess, duplicate: value.duplicate } : null;
}

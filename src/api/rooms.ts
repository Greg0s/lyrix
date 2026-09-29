import {
  isRoundView,
  parseRoomEntry,
  parseRoomGuessResult,
  type RoomEntry,
  type RoomGuessResult,
} from "../game/room";
import type { RoundView } from "../game/types";
import { apiUrl } from "./base";

/** Why creating or joining a room didn't work, as the player needs to hear it. */
export type RoomFailure = "not-found" | "rate-limited" | "unavailable";

export type RoomResult = { ok: true; entry: RoomEntry } | { ok: false; failure: RoomFailure };

function failure(reason: RoomFailure): RoomResult {
  return { ok: false, failure: reason };
}

async function enter(path: string, pseudo: string): Promise<RoomResult> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo }),
    });
  } catch {
    return failure("unavailable");
  }
  if (response.status === 404) return failure("not-found");
  if (response.status === 429) return failure("rate-limited");
  if (!response.ok) return failure("unavailable");
  const entry = parseRoomEntry(await response.json().catch(() => null));
  return entry ? { ok: true, entry } : failure("unavailable");
}

/** Creates a room; the player becomes its host. */
export function createRoom(pseudo: string): Promise<RoomResult> {
  return enter("/api/rooms", pseudo);
}

/** Joins the room with this code (already validated with isRoomCode). */
export function joinRoom(code: string, pseudo: string): Promise<RoomResult> {
  return enter(`/api/rooms/${encodeURIComponent(code)}/members`, pseudo);
}

/** Fire and forget: the player is out of the room locally whatever the network says. */
export function leaveRoom(code: string, token: string): void {
  void fetch(apiUrl(`/api/rooms/${encodeURIComponent(code)}/leave`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

/** The member's live connection to the room: ws(s) on the same host as the rest of the API. */
export function roomSocketUrl(code: string, token: string): string {
  const url = apiUrl(`/api/rooms/${encodeURIComponent(code)}/ws`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * A guess for the whole room (issue #30). Throws, like submitGuess, when it
 * couldn't be checked: the dock says so and the player can try again.
 */
export async function submitRoomGuess(code: string, token: string, word: string): Promise<RoomGuessResult> {
  const response = await fetch(apiUrl(`/api/rooms/${encodeURIComponent(code)}/guess`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, word }),
  });
  const body: unknown = await response.json().catch(() => null);
  const result = response.ok ? parseRoomGuessResult(body) : null;
  if (!result) throw new Error(`room guess failed with status ${response.status}`);
  return result;
}

/**
 * Once the room has found the song, a solo round for a member who didn't
 * complete the title: the group's finds but the winning word, merged with the
 * player's own solo `state` when there is one. Throws when it couldn't be had.
 */
export async function continueAlone(code: string, token: string, state: string | undefined): Promise<RoundView> {
  const response = await fetch(apiUrl(`/api/rooms/${encodeURIComponent(code)}/alone`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, state }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRoundView(body)) throw new Error(`continuing alone failed with status ${response.status}`);
  return body;
}

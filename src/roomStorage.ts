import { parseRoomEntry, type RoomEntry } from "./game/room";

/**
 * The room the player is in, so a reload (or a phone discarding the tab)
 * reconnects them instead of dropping them out of it. Holds the member token:
 * it only proves membership of this one room, and is gone with the room at
 * the next UTC midnight.
 */
const STORAGE_KEY = "lyrix:room";

/** The saved room, unless there is none, it is unreadable, or it has expired. */
export function loadSavedRoom(
  now: number = Date.now(),
  storage: Storage | undefined = globalThis.localStorage
): RoomEntry | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = parseRoomEntry(JSON.parse(raw) as unknown);
    if (!entry || entry.room.expiresAt <= now) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

// Small and rare (one write per room event), so written inline, unlike the round.
export function saveRoom(entry: RoomEntry, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Persistence is a nice-to-have (private browsing, quota): never fatal.
  }
}

export function clearSavedRoom(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Same as above.
  }
}

/**
 * The room whose answer the player chose to see after the group found the
 * song without them (#30), so a reload doesn't hide it again. One room at a
 * time: a player is only ever in one.
 */
const ANSWER_KEY = "lyrix:room-answer";

export function isAnswerRevealed(code: string, storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem(ANSWER_KEY) === code;
  } catch {
    return false;
  }
}

export function saveAnswerRevealed(code: string, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(ANSWER_KEY, code);
  } catch {
    // Persistence is a nice-to-have: never fatal.
  }
}

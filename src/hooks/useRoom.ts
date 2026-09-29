import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoom, joinRoom, leaveRoom, roomSocketUrl, type RoomFailure } from "../api/rooms";
import {
  memberName,
  parseRoomMessage,
  parseRoomRoundMessage,
  ROOM_CLOSE_EXPIRED,
  ROOM_CLOSE_LEFT,
  ROOM_CLOSE_UNKNOWN,
  ROOM_PING,
  ROOM_PONG,
  sanitizePseudo,
  type RoomEntry,
  type RoomMember,
  type RoomRoundMessage,
} from "../game/room";
import type { RoomSession } from "./useGame";
import { clearSavedRoom, loadSavedRoom, saveRoom } from "../roomStorage";

/** The room the player is in, as the interface draws it. */
export interface RoomView {
  code: string;
  /** The local player's member id. */
  you: string;
  host: RoomMember;
  /** Connected members, in arrival order. */
  members: RoomMember[];
  /** False once the live connection has dropped, until it is back: the members shown may be out of date. */
  connected: boolean;
}

export type RoomOutcome = { ok: true } | { ok: false; failure: RoomFailure };

/** Waits before each reconnection attempt in a row; the last one repeats. */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
/** Keeps an idle connection from being dropped along the way; answered without waking the room. */
export const KEEPALIVE_MS = 25_000;

/**
 * Rooms (issue #29), client side: creating, joining and leaving one, and the
 * WebSocket that keeps its member list live. The room is saved (roomStorage),
 * so a reload reconnects. `announce` puts a line in the guess dock's feedback
 * ("X a rejoint le salon.").
 *
 * The room's round (issue #30) comes over the same socket: `onRound` gets
 * each round message, and `onSession` is told which room the player is in
 * (null for none) before the page paints, so the round shown always belongs
 * to it. Pass stable functions (useGame's).
 */
export function useRoom(
  announce: (text: string) => void,
  onRound: (message: RoomRoundMessage) => void,
  onSession: (session: RoomSession | null) => void
) {
  const [entry, setEntry] = useState<RoomEntry | null>(() => loadSavedRoom());
  const [linkDown, setLinkDown] = useState(false);

  const code = entry?.room.code ?? null;
  const token = entry?.token ?? null;
  const you = entry?.you ?? null;

  // Layout, not passive: the solo round must never flash on screen while the
  // room's is on its way.
  useLayoutEffect(() => {
    onSession(code !== null && token !== null && you !== null ? { code, token, you } : null);
  }, [code, token, you, onSession]);

  useEffect(() => {
    if (code === null || token === null || you === null) return;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let keepaliveTimer: number | undefined;
    let attempt = 0;
    let disposed = false;

    // The server said this player is no longer in this room: stop retrying.
    const end = (notice?: string) => {
      clearSavedRoom();
      setEntry(null);
      setLinkDown(false);
      if (notice) announce(notice);
    };

    const open = () => {
      const current = new WebSocket(roomSocketUrl(code, token));
      socket = current;
      current.addEventListener("open", () => {
        attempt = 0;
        setLinkDown(false);
        keepaliveTimer = window.setInterval(() => current.send(ROOM_PING), KEEPALIVE_MS);
      });
      current.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (disposed || typeof event.data !== "string" || event.data === ROOM_PONG) return;
        let data: unknown;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        const round = parseRoomRoundMessage(data);
        if (round) return onRound(round);
        const message = parseRoomMessage(data);
        if (!message) return;
        const next: RoomEntry = { you, token, room: message.room };
        saveRoom(next);
        setEntry(next);
        const { event: change } = message;
        // The player hears about their own arrival from join() instead.
        if (change && change.member.id !== you) {
          const verb = change.kind === "joined" ? "a rejoint" : "a quitté";
          announce(`${memberName(change.member, you)} ${verb} le salon.`);
        }
      });
      current.addEventListener("close", (event) => {
        window.clearInterval(keepaliveTimer);
        if (disposed) return;
        if (event.code === ROOM_CLOSE_EXPIRED) return end("Le salon a expiré avec la chanson du jour.");
        if (event.code === ROOM_CLOSE_UNKNOWN) return end("Ce salon n’existe plus.");
        // Left from another tab: this one just follows.
        if (event.code === ROOM_CLOSE_LEFT) return end();
        setLinkDown(true);
        retryTimer = window.setTimeout(open, RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]);
        attempt += 1;
      });
    };

    open();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(keepaliveTimer);
      socket?.close(1000, "done");
    };
  }, [code, token, you, announce, onRound]);

  const enter = useCallback((next: RoomEntry) => {
    saveRoom(next);
    setLinkDown(false);
    setEntry(next);
  }, []);

  const create = useCallback(
    async (pseudo: string): Promise<RoomOutcome> => {
      const result = await createRoom(sanitizePseudo(pseudo));
      if (!result.ok) return result;
      enter(result.entry);
      return { ok: true };
    },
    [enter]
  );

  const join = useCallback(
    async (roomCode: string, pseudo: string): Promise<RoomOutcome> => {
      const result = await joinRoom(roomCode, sanitizePseudo(pseudo));
      if (!result.ok) return result;
      enter(result.entry);
      announce(`Tu as rejoint le salon de ${memberName(result.entry.room.host, result.entry.you)}.`);
      return { ok: true };
    },
    [announce, enter]
  );

  const leave = useCallback(() => {
    if (!entry) return;
    leaveRoom(entry.room.code, entry.token);
    clearSavedRoom();
    setLinkDown(false);
    setEntry(null);
  }, [entry]);

  const view = useMemo<RoomView | null>(
    () =>
      entry
        ? {
            code: entry.room.code,
            you: entry.you,
            host: entry.room.host,
            members: entry.room.members,
            connected: !linkDown,
          }
        : null,
    [entry, linkDown]
  );

  return { view, create, join, leave };
}

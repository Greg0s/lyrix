import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoom, joinRoom, leaveRoom, moveRoom, roomSocketUrl, type RoomFailure } from "../api/rooms";
import { utcDay } from "../game/daily";
import { longDayLabel } from "../game/frenchDates";
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
  type RoomEvent,
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

/** A room event as the dock's feedback line tells it. */
function roomEventText(change: RoomEvent, you: string): string {
  const name = memberName(change.member, you);
  if (change.kind === "day") {
    return change.day === utcDay()
      ? `${name} a ramené le salon sur la chanson du jour.`
      : `${name} a lancé l'archive du ${longDayLabel(change.day)}.`;
  }
  return change.kind === "joined" ? `${name} a rejoint le salon.` : `${name} a quitté le salon.`;
}

/** Waits before each reconnection attempt in a row; the last one repeats. */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
/** Keeps an idle connection from being dropped along the way; answered without waking the room. */
export const KEEPALIVE_MS = 25_000;
/**
 * How long a connection may stay silent when it owes an answer: the room's
 * welcome after connecting (it always sends the room as it stands), or the
 * pong to a keep-alive. A connection that died without closing (a phone
 * changing networks, a laptop waking up) sends nothing and fires no close,
 * and would otherwise pass for live while the room's news never arrives.
 */
export const SILENCE_TIMEOUT_MS = 10_000;

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
    let silenceTimer: number | undefined;
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
      // Lost once, whichever noticed first: its close event, or the silence below.
      let lost = false;

      const retry = () => {
        window.clearInterval(keepaliveTimer);
        window.clearTimeout(silenceTimer);
        silenceTimer = undefined;
        setLinkDown(true);
        retryTimer = window.setTimeout(open, RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]);
        attempt += 1;
      };
      // Armed while the connection owes an answer, disarmed by anything it sends.
      const expectAnswer = () => {
        if (silenceTimer !== undefined) return;
        silenceTimer = window.setTimeout(() => {
          silenceTimer = undefined;
          if (lost || disposed) return;
          lost = true;
          // Its close event may never come, or only minutes later: not waited for.
          current.close();
          retry();
        }, SILENCE_TIMEOUT_MS);
      };
      expectAnswer();

      current.addEventListener("open", () => {
        attempt = 0;
        setLinkDown(false);
        keepaliveTimer = window.setInterval(() => {
          current.send(ROOM_PING);
          expectAnswer();
        }, KEEPALIVE_MS);
      });
      current.addEventListener("message", (event: MessageEvent<unknown>) => {
        // A connection given up on has no say anymore, even if it wakes up.
        if (lost) return;
        window.clearTimeout(silenceTimer);
        silenceTimer = undefined;
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
        // The player hears about their own arrival from join() instead, and
        // sees for themselves the day they took the room to.
        if (change && change.member.id !== you) announce(roomEventText(change, you));
      });
      current.addEventListener("close", (event) => {
        if (lost) return;
        lost = true;
        window.clearInterval(keepaliveTimer);
        window.clearTimeout(silenceTimer);
        silenceTimer = undefined;
        if (disposed) return;
        if (event.code === ROOM_CLOSE_EXPIRED) return end("Le salon a expiré avec la chanson du jour.");
        if (event.code === ROOM_CLOSE_UNKNOWN) return end("Ce salon n’existe plus.");
        // Left from another tab: this one just follows.
        if (event.code === ROOM_CLOSE_LEFT) return end();
        retry();
      });
    };

    open();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(keepaliveTimer);
      window.clearTimeout(silenceTimer);
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
      // An invite link can bring a player from one room to another: they are
      // only ever in one, so the other one hears they left. Only once the new
      // room has let them in, so a failed join keeps them where they were.
      if (entry && entry.room.code !== result.entry.room.code) leaveRoom(entry.room.code, entry.token);
      enter(result.entry);
      announce(`Tu as rejoint le salon de ${memberName(result.entry.room.host, result.entry.you)}.`);
      return { ok: true };
    },
    [announce, enter, entry]
  );

  /**
   * Takes the whole room to another day's song (#B). The room's round of that
   * day comes back over the socket, to everyone; only a failure is told here.
   */
  const moveTo = useCallback(
    (day: string) => {
      if (!entry) return;
      moveRoom(entry.room.code, entry.token, day).catch(() => announce("Le salon n'a pas pu changer de jour."));
    },
    [announce, entry]
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

  return { view, create, join, leave, moveTo };
}

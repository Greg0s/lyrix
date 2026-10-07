import { useCallback, useEffect, useRef, useState } from "react";
import { isNetworkFailure } from "../api/base";
import { fetchRound, resumeRound, submitGuess } from "../api/client";
import { continueAlone, submitRoomGuess } from "../api/rooms";
import { utcDay } from "../game/daily";
import { applyReveal, isGuessDelta, revealedWords } from "../game/delta";
import { normalize } from "../game/normalize";
import {
  memberName,
  type RoomDaySummary,
  type RoomGuess,
  type RoomMember,
  type RoomRound,
  type RoomRoundMessage,
} from "../game/room";
import { parseNearSlots } from "../game/slots";
import type { NearSlot, RoundView } from "../game/types";
import { isAnswerRevealed, loadSavedRoom, saveAnswerRevealed } from "../roomStorage";
import { takePrefetchedRound } from "../roundPrefetch";
import {
  clearGroupSnapshot,
  flushSavedRound,
  loadGroupSnapshots,
  loadSavedDay,
  loadSavedRound,
  saveGroupSnapshotSoon,
  saveRound,
  saveRoundSoon,
} from "../roundStorage";

export interface TriedWord {
  key: string;
  display: string;
  found: boolean;
  /** Semantic proximity, 0-100; null when the word is unknown to the model or the song has no similarity table. */
  score: number | null;
  /** The hidden words this guess is close to, by position (see src/game/slots.ts); empty when it is close to none. */
  near: NearSlot[];
  /** In a room: the member who proposed it. Absent in solo play. */
  by?: RoomMember;
}

export interface Feedback {
  word: string;
  /** The guess's normalized key: what a revealed word is compared against to highlight the last one found. */
  key: string;
  found: boolean;
  /** True when the word had already been tried: nothing was sent, the player is just told so. */
  duplicate: boolean;
  /** How many hidden words the guess is close to, so a hint shown far down the lyrics doesn't go unnoticed. */
  nearCount: number;
  /** Bumped on every new feedback, so the same message twice in a row still replays its animation. */
  seq: number;
  /** In a room: the local player, whose colour the line carries. */
  by?: RoomMember;
}

function nextSeq(previous: Feedback | null): number {
  return (previous?.seq ?? 0) + 1;
}

/**
 * Something that happened outside the round (a player joining the room) and
 * belongs in the feedback line. It shows until the outcome of the player's
 * next guess, which clears it; it never touches `feedback`, so the last found
 * word stays highlighted in the lyrics meanwhile.
 */
export interface Notice {
  text: string;
  /** Bumped on every notice, so the same message twice in a row still replays its animation. */
  seq: number;
  /** Set when the notice is another room member's guess: the line carries their colour. */
  by?: RoomMember;
  /** How that guess went; a notice about anything else is plain information. */
  outcome?: "found" | "missed";
  /** The key of the word that guess found, highlighted in the lyrics like the player's own. */
  foundKey?: string;
}

/** The room the player is in, as far as the round is concerned (see useRoom). */
export interface RoomSession {
  code: string;
  token: string;
  /** The local player's member id. */
  you: string;
}

/**
 * The round a room plays together (issue #30). Its found words live in the
 * room's Durable Object; this is only the latest view of it the Worker sent,
 * by socket or in answer to a guess. Never saved locally: a reload gets it
 * back from the room itself.
 */
interface SharedRound extends RoomSession {
  /** Null until the room has sent it. */
  round: RoundView | null;
  triedWords: TriedWord[];
  /** Once the group has found the song: the guess that completed the title (RoomRound.winningKey). */
  winningKey: string | null;
  /** The player chose to see the answer the group found without them. Saved per room (roomStorage). */
  revealed: boolean;
  /** The solo round to keep looking on was asked for (see useGame's effect): once per room session and day. */
  aloneRequested: boolean;
  /** Every day the room played, for the group's collection in the archives. */
  days: RoomDaySummary[];
}

/** Who completed the title for the group, once someone has. */
function groupWinner(shared: SharedRound): RoomMember | null {
  if (!shared.round?.victory || shared.winningKey === null) return null;
  return shared.triedWords.find((word) => word.key === shared.winningKey)?.by ?? null;
}

/**
 * The group found the song, but not this player, who hasn't asked for the
 * answer: they keep looking on their own, on their solo round, and the room's
 * round (the answer in full) stays out of sight.
 */
function lookingAlone(shared: SharedRound | null): boolean {
  if (!shared || shared.revealed) return false;
  const winner = groupWinner(shared);
  return winner !== null && winner.id !== shared.you;
}

function triedWordFrom({ key, display, found, score, near, by }: RoomGuess): TriedWord {
  return { key, display, found, score, near, by };
}

/**
 * The room's round, updated to `update` unless that is older than what is
 * shown: an answer and a broadcast travel separately and can cross, but a
 * room's guesses only ever grow, so their count orders them.
 */
function withRoomRound(shared: SharedRound, update: RoomRound): SharedRound {
  // Another day's round (the room moved, #B) always replaces the one shown;
  // the answer on that day is the player's to ask for again.
  const otherDay = shared.round !== null && shared.round.day !== update.round.day;
  if (shared.round && !otherDay && update.guesses.length <= shared.triedWords.length) return shared;
  return {
    ...shared,
    round: update.round,
    triedWords: update.guesses.map(triedWordFrom),
    winningKey: update.winningKey ?? null,
    days: update.days ?? shared.days,
    ...(otherDay || shared.round === null
      ? { revealed: isAnswerRevealed(shared.code, update.round.day), aloneRequested: false }
      : {}),
  };
}

/** Another member's guess, as the dock's feedback line tells it. The winning word is never named: it would give the answer away. */
function teammateNotice(guess: RoomGuess, you: string, seq: number, winning: boolean): Notice {
  const name = memberName(guess.by, you);
  if (winning) return { text: `${name} a trouvé la chanson !`, seq, by: guess.by, outcome: "found" };
  return guess.found
    ? { text: `${name} a trouvé « ${guess.display} » !`, seq, by: guess.by, outcome: "found", foundKey: guess.key }
    : { text: `${name} a proposé « ${guess.display} », sans succès.`, seq, by: guess.by, outcome: "missed" };
}

interface GameState {
  /** Which solo round is played: null for today's song, or a day of the archives (YYYY-MM-DD). */
  day: string | null;
  /** The solo round: the player's own, saved locally. */
  round: RoundView | null;
  triedWords: TriedWord[];
  /** While in a room, the room's round, shown in place of the solo one; null otherwise. */
  shared: SharedRound | null;
  inputValue: string;
  feedback: Feedback | null;
  notice: Notice | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  /**
   * Bumped when a guess of the player's own completes the title of the round
   * on screen, so the win is celebrated (TitleGuess, #42); never by a round
   * that comes back already won, from storage or from a room. Back to 0
   * whenever the player's room changes or the group's answer is shown, so a
   * celebration never plays over a round the player didn't just win.
   */
  celebration: number;
}

const initialState: GameState = {
  day: null,
  round: null,
  triedWords: [],
  shared: null,
  inputValue: "",
  feedback: null,
  notice: null,
  loading: true,
  submitting: false,
  error: null,
  celebration: 0,
};

/** Today's round straight from storage, when its view was saved: no network, no loading screen. */
function hydratedState(day: string | null): GameState | null {
  if (day !== null) return null;
  const saved = loadSavedRound();
  if (!saved) return null;
  return {
    day: null,
    round: saved.round,
    triedWords: saved.triedWords,
    shared: null,
    inputValue: "",
    feedback: null,
    notice: null,
    loading: false,
    submitting: false,
    error: null,
    celebration: 0,
  };
}

const NO_ROOM_DAYS: RoomDaySummary[] = [];

/** The player's own words, then the words the group found that they hadn't: what a round merged with a room's lists. */
function withGroupFinds(own: readonly TriedWord[], group: readonly TriedWord[]): TriedWord[] {
  const keys = new Set(own.map((word) => word.key));
  return [...own, ...group.filter((word) => word.found && !keys.has(word.key))];
}

/** The room's round is played on today's song only: on a day of the archives, the player plays alone. */
function roomShown(state: GameState): boolean {
  return state.shared !== null && onRoomDay(state) && !lookingAlone(state.shared);
}

/**
 * The day on screen is the one the room plays (#B): the room's round takes
 * its place. Until the room has sent its round, it is taken to play today's.
 */
function onRoomDay(state: GameState): boolean {
  if (!state.shared) return false;
  const roomDay = state.shared.round?.day;
  return roomDay === undefined ? state.day === null : (state.day ?? utcDay()) === roomDay;
}

/** The solo round is the one on screen: out of a room, looking alone in one, or on a day of the archives. */
function showsSoloRound(state: GameState): boolean {
  return !roomShown(state);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * A day's round and the words tried on it: from its saved state when it was
 * played before (the Worker rebuilds the view), fresh otherwise. A saved
 * state the Worker no longer opens starts the day afresh rather than lock
 * the player out of it. One it couldn't be asked about (offline, or too slow
 * to answer) is a failed load instead, retried as is: starting afresh then
 * would have overwritten the day's progress with the next guess.
 */
async function fetchDay(day: string | null, signal: AbortSignal): Promise<{ round: RoundView; triedWords: TriedWord[] }> {
  const saved = loadSavedDay(day ?? utcDay());
  if (saved) {
    try {
      return { round: await resumeRound([saved.state], day ?? utcDay(), signal), triedWords: saved.triedWords };
    } catch (error) {
      if (isAbort(error) || isNetworkFailure(error)) throw error;
    }
  }
  // Today's, asked for before the app even rendered when there is one (roundPrefetch.ts).
  const prefetched = day === null ? takePrefetchedRound() : null;
  const round = await (prefetched ?? fetchRound(signal, day ?? undefined));
  // Deferred too: the freshly loaded round is the largest thing we ever
  // serialize, and it sits right before the game's first paint. Today's
  // only: a day of the archives joins them once the player tries a word.
  if (day === null) saveRoundSoon(round, []);
  return { round, triedWords: [] };
}

/**
 * The game, on today's song (`day` null) or on a day of the archives. In a
 * room, the room's round takes today's place (#30); a day of the archives is
 * always played alone, and the room carries on meanwhile.
 */
export function useGame(day: string | null = null) {
  const [state, setState] = useState<GameState>(() => hydratedState(day) ?? { ...initialState, day });
  // Aborts any load a newer one supersedes (React StrictMode's double-invoked
  // mount effect, a retry fired while a load is still in flight, or the
  // player moving on to another day), so a slower, superseded response can
  // never overwrite a newer one.
  const abortRef = useRef<AbortController | null>(null);
  // Which day the round in state was loaded for, so the effect below doesn't
  // load it again: today's, when it hydrated from storage on the first render.
  const loadedFor = useRef<string | null | undefined>(state.round ? day : undefined);
  const dayRef = useRef(day);
  dayRef.current = day;

  const loadDay = useCallback(async (target: string | null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadedFor.current = target;

    // Today's round, saved with its view, needs no network at all.
    const saved = target === null ? loadSavedRound() : null;
    setState((prev) => {
      const switching = prev.day !== target;
      // In a room, the notice is likely why the day changed ("Léo a lancé l'archive du…"): it stays.
      const reset = switching
        ? { inputValue: "", feedback: null, celebration: 0, submitting: false, ...(prev.shared ? {} : { notice: null }) }
        : {};
      if (saved) return { ...prev, ...reset, day: target, round: saved.round, triedWords: saved.triedWords, loading: false, error: null };
      return switching
        ? { ...prev, ...reset, day: target, round: null, triedWords: [], loading: true, error: null }
        : { ...prev, loading: true, error: null };
    });
    if (saved) return;

    try {
      const { round, triedWords } = await fetchDay(target, controller.signal);
      setState((prev) => {
        if (prev.day !== target) return prev;
        return {
          ...prev,
          round,
          triedWords,
          // A room's round and what the player is typing are no business of the solo round's.
          ...(roomShown(prev) ? {} : { inputValue: "", feedback: null, notice: null }),
          loading: false,
          error: null,
        };
      });
    } catch (error) {
      if (isAbort(error)) return;
      setState((prev) =>
        prev.day !== target
          ? prev
          : { ...prev, loading: false, error: error instanceof Error ? error.message : "Impossible de charger la partie." }
      );
    }
  }, []);

  /** Loads the round of the day shown again: the retry button. */
  const loadRound = useCallback(() => loadDay(dayRef.current), [loadDay]);

  useEffect(() => {
    if (loadedFor.current === day) return;
    void loadDay(day);
    // Superseded (another day) or unmounted (StrictMode's double mount
    // included): the load is dropped, and forgotten, so the next run of
    // this effect loads the day again instead of believing it loaded.
    return () => {
      abortRef.current?.abort();
      loadedFor.current = undefined;
    };
  }, [day, loadDay]);

  const setInputValue = useCallback((value: string) => {
    setState((prev) => ({ ...prev, inputValue: value }));
  }, []);

  /**
   * Replaces the solo round with the view `sealed` stands for, rebuilt by the
   * Worker: what a delta that didn't add up comes to. Only while that state is
   * still the round's: a later guess has moved it on, and brought its own.
   * Failing, the round stays as it was shown: the next guess sends the right state anyway.
   */
  const resyncRound = useCallback(async (sealed: string, roundDay: string, playedDay: string | null) => {
    let view: RoundView;
    try {
      view = await resumeRound([sealed], roundDay);
    } catch {
      return;
    }
    setState((prev) => {
      if (prev.day !== playedDay || prev.round?.state !== sealed) return prev;
      saveRoundSoon(view, prev.triedWords);
      return { ...prev, round: view };
    });
  }, []);

  const submit = useCallback(async () => {
    const { inputValue, submitting } = state;
    // Looking alone after the group won, or on a day of the archives: the player's guesses are their own.
    const shared = roomShown(state) ? state.shared : null;
    const round = shared ? shared.round : state.round;
    const triedWords = shared ? shared.triedWords : state.triedWords;
    const raw = inputValue.trim();
    // Guards against a second guess firing while one is still in flight
    // (e.g. a fast double Enter), which would otherwise race and let a
    // slower response clobber a faster one's revealed words.
    if (!raw || !round || submitting) return;

    // Mirror the server's own normalization so a repeat guess is a free,
    // instant no-op instead of a round trip. In a room, anyone's counts.
    const key = normalize(raw);
    const by = shared ? triedWords.find((word) => word.key === key)?.by : undefined;
    if (triedWords.some((word) => word.key === key)) {
      setState((prev) => ({
        ...prev,
        inputValue: "",
        error: null,
        notice: null,
        feedback: { word: raw, key, found: false, duplicate: true, nearCount: 0, seq: nextSeq(prev.feedback), by },
      }));
      return;
    }

    setState((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      if (shared) {
        const result = await submitRoomGuess(shared.code, shared.token, raw, round.day);
        const { guess } = result;
        // This very guess completed the title (RoomRound.winningKey): the
        // group's win is the player's. A teammate's, landing first, is not.
        const won = !result.duplicate && !round.victory && result.round.victory && result.winningKey === guess.key;
        setState((prev) => ({
          ...prev,
          // Unless the player left the room while the guess was on its way.
          shared: prev.shared?.code === shared.code ? withRoomRound(prev.shared, result) : prev.shared,
          inputValue: prev.inputValue === inputValue ? "" : prev.inputValue,
          submitting: false,
          notice: null,
          feedback: {
            word: result.duplicate ? raw : guess.display,
            key: guess.key,
            found: !result.duplicate && guess.found,
            duplicate: result.duplicate,
            nearCount: result.duplicate ? 0 : guess.near.length,
            seq: nextSeq(prev.feedback),
            by: guess.by,
          },
          celebration: won && prev.shared?.code === shared.code ? prev.celebration + 1 : prev.celebration,
        }));
        return;
      }

      const result = await submitGuess(round.state, raw);
      // What the guess changed, applied to the round it was made on (the one
      // whose state was sent); a full view (a win, or an older Worker) as is.
      const next = isGuessDelta(result) ? applyReveal(round, result.reveal, result.state) : result;
      // Parsed rather than trusted: a Worker deployed before close words were
      // placed in the lyrics sends no `near` at all.
      const near = parseNearSlots(result.near);
      const newTriedWords = [
        { key: result.key, display: raw, found: result.found, score: result.score ?? null, near },
        ...triedWords,
      ];
      // Deferred: serializing the whole masked round is the one heavy thing
      // between the answer arriving and the player seeing it (see roundStorage).
      saveRoundSoon(next, newTriedWords);
      // This very guess completed the title: the one moment the win is celebrated.
      const won = next.victory && !round.victory;
      // Saved all the same, but not shown over the day the player moved on to.
      const playedDay = state.day;
      // The round on screen no longer agrees with the Worker's count of what is
      // revealed: shown as it is, then replaced by the view the state stands for.
      if (isGuessDelta(result) && revealedWords(next) !== result.revealed) {
        void resyncRound(result.state, next.day, playedDay);
      }
      setState((prev) => prev.day !== playedDay ? { ...prev, submitting: false } : ({
        ...prev,
        round: next,
        // The input stays editable while a guess is in flight (disabling it
        // would close a phone's keyboard): keep whatever was typed meanwhile.
        inputValue: prev.inputValue === inputValue ? "" : prev.inputValue,
        submitting: false,
        notice: null,
        feedback: {
          word: raw,
          key: result.key,
          found: result.found,
          duplicate: false,
          nearCount: near.length,
          seq: nextSeq(prev.feedback),
        },
        triedWords: newTriedWords,
        // Unless another round took the screen while the guess was on its way.
        celebration: won && showsSoloRound(prev) ? prev.celebration + 1 : prev.celebration,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        notice: null,
        error: error instanceof Error ? error.message : "Impossible de vérifier ce mot.",
      }));
    }
  }, [state, resyncRound]);

  const announce = useCallback((text: string) => {
    setState((prev) => ({ ...prev, notice: { text, seq: (prev.notice?.seq ?? 0) + 1 } }));
  }, []);

  /** Called by useRoom whenever the player enters, changes or leaves a room. Pass null for none. */
  const setRoomSession = useCallback((session: RoomSession | null) => {
    setState((prev) => {
      const current = prev.shared;
      if (!session) return current ? { ...prev, shared: null, submitting: false, celebration: 0 } : prev;
      if (current && current.code === session.code && current.token === session.token) return prev;
      const shared: SharedRound = {
        ...session,
        round: null,
        triedWords: [],
        winningKey: null,
        revealed: false,
        aloneRequested: false,
        days: [],
      };
      return { ...prev, shared, submitting: false, error: null, celebration: 0 };
    });
  }, []);

  /** A round message off the room's socket: the room's round as it now stands, and whose guess changed it. */
  const receiveRoomRound = useCallback((message: RoomRoundMessage) => {
    setState((prev) => {
      const current = prev.shared;
      if (!current) return prev;
      const shared = withRoomRound(current, message);
      if (shared === current) return prev;
      // The player's own guess is told by its answer (submit), with the player's own wording.
      const latest = message.latest ? message.guesses.find((guess) => guess.key === message.latest) : undefined;
      const winning = latest !== undefined && latest.key === message.winningKey;
      // Looking alone, the room's later finds would give words away: only the win itself is news.
      // On another day than the room's, its round isn't the one played: none of it is.
      const quiet = !onRoomDay({ ...prev, shared }) || (lookingAlone(current) && !winning);
      const notice =
        latest && latest.by.id !== current.you && !quiet
          ? teammateNotice(latest, current.you, (prev.notice?.seq ?? 0) + 1, winning)
          : prev.notice;
      return { ...prev, shared, notice };
    });
  }, []);

  /** Shows the room's round, the answer included, to a player who was looking alone. */
  const revealAnswer = useCallback(() => {
    setState((prev) => {
      if (!prev.shared?.round) return prev;
      saveAnswerRevealed(prev.shared.code, prev.shared.round.day);
      return { ...prev, shared: { ...prev.shared, revealed: true }, notice: null, feedback: null, error: null, celebration: 0 };
    });
  }, []);

  // The group won without this player: their solo round becomes the group's
  // progress but the winning word, plus their own finds (signed by the room,
  // never merged here). Asked once per room session, once the solo round has
  // loaded, so its own progress goes along. Without it, the solo round as is.
  const alone = lookingAlone(state.shared);
  // The solo round of the room's day only: the one the room's song is played on.
  const aloneSession =
    alone && state.shared && !state.shared.aloneRequested && !state.loading && onRoomDay(state) ? state.shared : null;
  const soloState = state.round?.state;
  useEffect(() => {
    if (!aloneSession?.round) return;
    const { code, token } = aloneSession;
    const { day: roomDay } = aloneSession.round;
    setState((prev) => (prev.shared ? { ...prev, shared: { ...prev.shared, aloneRequested: true } } : prev));
    continueAlone(code, token, soloState, roomDay)
      .then((round) => {
        setState((prev) => {
          if (prev.shared?.code !== code || (prev.day ?? utcDay()) !== round.day) return prev;
          saveRoundSoon(round, prev.triedWords);
          return { ...prev, round, error: null };
        });
      })
      .catch(() => {});
  }, [aloneSession, soloState]);

  // While in a room, what it has found is kept aside, to join the player's own
  // round once out of it (see GroupSnapshot) - unless the player is looking
  // alone, whose solo round already holds the group's progress but the
  // winning word: keeping the room's state would hand them that word.
  const sharedNow = state.shared;
  useEffect(() => {
    if (!sharedNow?.round || lookingAlone(sharedNow)) return;
    saveGroupSnapshotSoon({
      day: sharedNow.round.day ?? utcDay(),
      code: sharedNow.code,
      state: sharedNow.round.state,
      found: sharedNow.triedWords.filter((word) => word.found),
    });
  }, [sharedNow]);

  // Out of every room (left, expired, or on a later visit): each room's
  // progress joins the player's own round of its day, their found words put
  // together by the Worker (POST /api/round/resume), so nothing found alone
  // or together is lost. A saved room means the player is still in one, on
  // its way back: nothing is merged then. Nor while a round is loading, whose
  // answer would land over the merged one, on screen and in storage.
  const outOfRoom = state.shared === null && !state.loading;
  // One merge at a time (StrictMode runs the effect twice).
  const merging = useRef(false);
  useEffect(() => {
    if (!outOfRoom || merging.current || loadSavedRoom() !== null) return;
    const snapshots = loadGroupSnapshots();
    if (snapshots.length === 0) return;
    merging.current = true;
    void (async () => {
      for (const snapshot of snapshots) {
        // The latest of the player's own first, a write of it still pending included.
        flushSavedRound();
        const own = loadSavedDay(snapshot.day);
        let merged: RoundView;
        try {
          merged = await resumeRound(own ? [own.state, snapshot.state] : [snapshot.state], snapshot.day);
        } catch (error) {
          // Offline or too slow: tried again on the next visit. Refused (a
          // state the Worker no longer opens): nothing to merge, ever.
          if (!isNetworkFailure(error)) clearGroupSnapshot(snapshot);
          continue;
        }
        const triedWords = withGroupFinds(own?.triedWords ?? [], snapshot.found);
        saveRound(merged, triedWords);
        clearGroupSnapshot(snapshot);
        // On screen if it is the solo round of that day.
        setState((prev) =>
          prev.shared === null && prev.round?.day === snapshot.day ? { ...prev, round: merged, triedWords } : prev
        );
      }
      merging.current = false;
    })();
  }, [outOfRoom]);

  // In a room, its round takes today's solo one's place, unless the player is
  // looking alone; the solo round is kept as it was, for then and for when
  // the player leaves. A day of the archives is always the player's own.
  const shared = roomShown(state) ? state.shared : null;
  const winner = state.shared ? groupWinner(state.shared) : null;
  return {
    ...state,
    round: shared ? shared.round : state.round,
    triedWords: shared ? shared.triedWords : state.triedWords,
    inRoom: state.shared !== null,
    /** True while the room's round is the one shown and played. */
    playingRoom: shared !== null,
    /** Who found the song for the group, while this player is looking alone; null otherwise. */
    aloneAfter: alone && onRoomDay(state) ? winner : null,
    /** The day the player's room plays, once it has said so; null out of a room. */
    roomDay: state.shared?.round?.day ?? null,
    /** Whether the player asked for the answer the group found on the room's day. */
    roomRevealed: state.shared?.revealed ?? false,
    /** Every day the player's room played, for the group's collection. */
    roomDays: state.shared?.days ?? NO_ROOM_DAYS,
    revealAnswer,
    setInputValue,
    submit,
    loadRound,
    announce,
    setRoomSession,
    receiveRoomRound,
  };
}

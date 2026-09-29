import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRound, submitGuess } from "../api/client";
import { submitRoomGuess } from "../api/rooms";
import { normalize } from "../game/normalize";
import { memberName, type RoomGuess, type RoomMember, type RoomRound, type RoomRoundMessage } from "../game/room";
import { parseNearSlots } from "../game/slots";
import type { NearSlot, RoundView } from "../game/types";
import { loadSavedRound, saveRoundSoon } from "../roundStorage";

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
  if (shared.round && update.guesses.length <= shared.triedWords.length) return shared;
  return { ...shared, round: update.round, triedWords: update.guesses.map(triedWordFrom) };
}

/** Another member's guess, as the dock's feedback line tells it. */
function teammateNotice(guess: RoomGuess, you: string, seq: number): Notice {
  const name = memberName(guess.by, you);
  return guess.found
    ? { text: `${name} a trouvé « ${guess.display} » !`, seq, by: guess.by, outcome: "found", foundKey: guess.key }
    : { text: `${name} a proposé « ${guess.display} », sans succès.`, seq, by: guess.by, outcome: "missed" };
}

interface GameState {
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
}

const initialState: GameState = {
  round: null,
  triedWords: [],
  shared: null,
  inputValue: "",
  feedback: null,
  notice: null,
  loading: true,
  submitting: false,
  error: null,
};

function hydratedState(): GameState | null {
  const saved = loadSavedRound();
  if (!saved) return null;
  return {
    round: saved.round,
    triedWords: saved.triedWords,
    shared: null,
    inputValue: "",
    feedback: null,
    notice: null,
    loading: false,
    submitting: false,
    error: null,
  };
}

export function useGame() {
  const [state, setState] = useState<GameState>(() => hydratedState() ?? initialState);
  // Aborts any load a newer one supersedes (React StrictMode's double-invoked
  // mount effect, or a retry fired while a load is still in flight), so a
  // slower, superseded response can never overwrite a newer one.
  const abortRef = useRef<AbortController | null>(null);

  const loadRound = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const round = await fetchRound(controller.signal);
      // Deferred too: the freshly loaded round is the largest thing we ever
      // serialize, and it sits right before the game's first paint.
      saveRoundSoon(round, []);
      setState((prev) => ({
        ...prev,
        round,
        triedWords: [],
        // A room's round and what the player is typing are no business of the solo round's.
        ...(prev.shared ? {} : { inputValue: "", feedback: null, notice: null }),
        loading: false,
        error: null,
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Impossible de charger la partie.",
      }));
    }
  }, []);

  // The initial state above already hydrated synchronously from storage when
  // today's round was saved, so the mount effect below must not hit the
  // network for it. Answered from that first render rather than by parsing
  // storage a second time (three times, under StrictMode's double mount).
  const hydratedFromStorage = useRef(state.round !== null);

  useEffect(() => {
    if (hydratedFromStorage.current) return;
    void loadRound();
    return () => abortRef.current?.abort();
  }, [loadRound]);

  const setInputValue = useCallback((value: string) => {
    setState((prev) => ({ ...prev, inputValue: value }));
  }, []);

  const submit = useCallback(async () => {
    const { inputValue, submitting, shared } = state;
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
        const result = await submitRoomGuess(shared.code, shared.token, raw);
        const { guess } = result;
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
        }));
        return;
      }

      const result = await submitGuess(round.state, raw);
      // Parsed rather than trusted: a Worker deployed before close words were
      // placed in the lyrics sends no `near` at all.
      const near = parseNearSlots(result.near);
      const newTriedWords = [
        { key: result.key, display: raw, found: result.found, score: result.score ?? null, near },
        ...triedWords,
      ];
      // Deferred: serializing the whole masked round is the one heavy thing
      // between the answer arriving and the player seeing it (see roundStorage).
      saveRoundSoon(result, newTriedWords);
      setState((prev) => ({
        ...prev,
        round: result,
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
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        notice: null,
        error: error instanceof Error ? error.message : "Impossible de vérifier ce mot.",
      }));
    }
  }, [state]);

  const announce = useCallback((text: string) => {
    setState((prev) => ({ ...prev, notice: { text, seq: (prev.notice?.seq ?? 0) + 1 } }));
  }, []);

  /** Called by useRoom whenever the player enters, changes or leaves a room. Pass null for none. */
  const setRoomSession = useCallback((session: RoomSession | null) => {
    setState((prev) => {
      const current = prev.shared;
      if (!session) return current ? { ...prev, shared: null, submitting: false } : prev;
      if (current && current.code === session.code && current.token === session.token) return prev;
      return { ...prev, shared: { ...session, round: null, triedWords: [] }, submitting: false, error: null };
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
      const notice =
        latest && latest.by.id !== current.you
          ? teammateNotice(latest, current.you, (prev.notice?.seq ?? 0) + 1)
          : prev.notice;
      return { ...prev, shared, notice };
    });
  }, []);

  // In a room, its round takes the solo one's place everywhere; the solo round
  // is kept as it was, for when the player leaves.
  const { shared } = state;
  return {
    ...state,
    round: shared ? shared.round : state.round,
    triedWords: shared ? shared.triedWords : state.triedWords,
    inRoom: shared !== null,
    setInputValue,
    submit,
    loadRound,
    announce,
    setRoomSession,
    receiveRoomRound,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRound, submitGuess } from "../api/client";
import { normalize } from "../game/normalize";
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
}

interface Feedback {
  word: string;
  found: boolean;
  /** How many hidden words the guess is close to, so a hint shown far down the lyrics doesn't go unnoticed. */
  nearCount: number;
}

interface GameState {
  round: RoundView | null;
  triedWords: TriedWord[];
  inputValue: string;
  feedback: Feedback | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
}

const initialState: GameState = {
  round: null,
  triedWords: [],
  inputValue: "",
  feedback: null,
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
    inputValue: "",
    feedback: null,
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
      setState({
        round,
        triedWords: [],
        inputValue: "",
        feedback: null,
        loading: false,
        submitting: false,
        error: null,
      });
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
    const { round, inputValue, triedWords, submitting } = state;
    const raw = inputValue.trim();
    // Guards against a second guess firing while one is still in flight
    // (e.g. a fast double Enter), which would otherwise race and let a
    // slower response clobber a faster one's revealed words.
    if (!raw || !round || submitting) return;

    // Mirror the server's own normalization so a repeat guess is a free,
    // instant no-op instead of a round trip.
    const key = normalize(raw);
    if (triedWords.some((word) => word.key === key)) {
      setState((prev) => ({ ...prev, inputValue: "" }));
      return;
    }

    setState((prev) => ({ ...prev, submitting: true, error: null }));
    try {
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
        inputValue: "",
        submitting: false,
        feedback: { word: raw, found: result.found, nearCount: near.length },
        triedWords: newTriedWords,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: error instanceof Error ? error.message : "Impossible de vérifier ce mot.",
      }));
    }
  }, [state]);

  return { ...state, setInputValue, submit, loadRound };
}

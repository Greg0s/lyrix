import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRound, submitGuess } from "../api/client";
import { normalize } from "../game/normalize";
import type { RoundView } from "../game/types";

export interface TriedWord {
  key: string;
  display: string;
  found: boolean;
}

interface Feedback {
  word: string;
  found: boolean;
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

export function useGame() {
  const [state, setState] = useState<GameState>(initialState);
  // Aborts any load a newer one supersedes (React StrictMode's double-invoked
  // mount effect, or a replay fired while the initial load is still in
  // flight), so a slower, superseded response can never overwrite a newer one.
  const abortRef = useRef<AbortController | null>(null);

  const loadRound = useCallback(async (excludeSongId?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const round = await fetchRound(excludeSongId, controller.signal);
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

  useEffect(() => {
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
      setState((prev) => ({
        ...prev,
        round: result,
        inputValue: "",
        submitting: false,
        feedback: { word: raw, found: result.found },
        triedWords: [{ key: result.key, display: raw, found: result.found }, ...prev.triedWords],
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: error instanceof Error ? error.message : "Impossible de vérifier ce mot.",
      }));
    }
  }, [state]);

  const replay = useCallback(() => {
    void loadRound(state.round?.songId);
  }, [loadRound, state.round?.songId]);

  return { ...state, setInputValue, submit, replay };
}

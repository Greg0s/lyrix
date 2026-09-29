import { useEffect, useRef, type FocusEvent, type KeyboardEvent } from "react";

const BLANK = ".token-blank";

/** Arrow keys and Home/End: where each one moves focus, given the focused bar's index among `count` bars. */
function target(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(index + 1, count - 1);
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Roving focus over the hidden-word bars inside one container (the title, or
 * the lyrics): a single tab stop into it, then arrow keys move from bar to bar.
 * A song has hundreds of bars, so making each one a tab stop would make the
 * rest of the page unreachable from the keyboard.
 *
 * Which bar holds the tab stop lives in the DOM (`tabIndex`), not in React
 * state, so moving it re-renders nothing - not the lyrics, not a single token.
 * The effect has no dependency list on purpose: its owner is memo()'d, so it
 * runs exactly when the bars inside may have changed, i.e. after a guess.
 */
export function useRovingBlanks<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const stop = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const blanks = Array.from(container.querySelectorAll<HTMLElement>(BLANK));
    // Keep the tab stop where the player left it, unless that word has since been found.
    const kept = stop.current && blanks.includes(stop.current) ? stop.current : null;
    stop.current = kept ?? blanks[0] ?? null;
    for (const blank of blanks) blank.tabIndex = blank === stop.current ? 0 : -1;
  });

  const onFocus = (event: FocusEvent<T>) => {
    const blank = event.target;
    if (!(blank instanceof HTMLElement) || !blank.matches(BLANK) || blank === stop.current) return;
    if (stop.current) stop.current.tabIndex = -1;
    blank.tabIndex = 0;
    stop.current = blank;
  };

  const onKeyDown = (event: KeyboardEvent<T>) => {
    const blank = event.target;
    const container = ref.current;
    if (!container || !(blank instanceof HTMLElement) || !blank.matches(BLANK)) return;
    const blanks = Array.from(container.querySelectorAll<HTMLElement>(BLANK));
    const next = target(event.key, blanks.indexOf(blank), blanks.length);
    if (next === null) return;
    event.preventDefault();
    blanks[next]?.focus();
  };

  return { ref, onFocus, onKeyDown };
}

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 760;

/** Same threshold as a `window.innerWidth < 760` check, expressed as a query. */
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * matchMedia rather than a `resize` listener: the browser fires `change` only
 * when the breakpoint is actually crossed, where `resize` fires continuously
 * while a window is being dragged and had us read `window.innerWidth` — a
 * forced layout — on every one of those frames, to nearly always conclude that
 * nothing had changed.
 *
 * The MediaQueryList is created once and kept: useSyncExternalStore asks for
 * the current value on every render, and a fresh one per call would allocate
 * for nothing.
 */
let query: MediaQueryList | null | undefined;

function mobileQuery(): MediaQueryList | null {
  if (query === undefined) {
    query = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(MOBILE_QUERY) : null;
  }
  return query;
}

function subscribe(onChange: () => void): () => void {
  const list = mobileQuery();
  if (!list) return () => {};
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return mobileQuery()?.matches ?? false;
}

/** Where matchMedia is unavailable (a server render, an old browser), the layout falls back to the desktop one. */
function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

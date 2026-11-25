import { useEffect, useRef } from "react";
import { countClick } from "../analytics";
import type { Route } from "../routes";
import { swipedTab, tabEvent, tabRoute } from "../tabs";

/** Below this width, the phone's layout and its tab bar (game.css's breakpoint). */
export const SWIPE_MEDIA = "(max-width: 879px)";
/** How far a finger must travel sideways for a swipe, in CSS pixels. */
export const SWIPE_MIN_DISTANCE = 64;
/** A swipe is at least this many times wider than it is tall. */
export const SWIPE_MIN_RATIO = 2;
/** Moved this far up or down before sideways, a touch is a scroll, whatever comes next. */
export const SCROLL_SLOP = 12;
/** Longer than this, a touch is a drag or a reading finger, not a swipe. */
export const SWIPE_MAX_MS = 700;
/**
 * Touches starting this close to either side of the screen are left alone:
 * Android's back gesture (and Safari's) starts there.
 */
export const EDGE_ZONE = 28;

/**
 * Where a touch can't start a swipe: the guess dock (its input, its buttons,
 * the tour's invitation in its place), a slider, anything editable, and
 * anything marked so. A field merely touched may start one (the room's page
 * is mostly its form); a focused one stops them all (canStartSwipe). A
 * horizontally scrollable element is checked on its own (scrollsSideways).
 */
const NO_SWIPE = 'input[type="range"], [contenteditable], .lyrix-dock, [data-no-swipe]';

export interface TouchTrack {
  x: number;
  y: number;
  /** Set once the touch moved more up or down than sideways: a scroll. */
  scrolling: boolean;
}

/** What a finished touch was: a swipe one way or the other, or nothing to act on. */
export function readSwipe(dx: number, dy: number, ms: number): "left" | "right" | null {
  if (ms > SWIPE_MAX_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) < SWIPE_MIN_RATIO * Math.abs(dy)) return null;
  return dx < 0 ? "left" : "right";
}

/** Whether a touch moving by (dx, dy) so far is a vertical scroll: up or down first, before sideways. */
export function startsScrolling(dx: number, dy: number): boolean {
  return Math.abs(dy) > SCROLL_SLOP && Math.abs(dy) >= Math.abs(dx);
}

function scrollsSideways(element: Element): boolean {
  const overflow = window.getComputedStyle(element).overflowX;
  return overflow === "auto" || overflow === "scroll";
}

/** Whether a touch starting on `target` at `x` may become a swipe. */
export function canStartSwipe(target: EventTarget | null, x: number, width: number): boolean {
  if (x < EDGE_ZONE || x > width - EDGE_ZONE) return false;
  // A dialog or a sheet open, or the guided tour: the swipe is theirs, or nobody's.
  if (document.querySelector('[aria-modal="true"]')) return false;
  // The keyboard up: the player is typing, and the tab bar has stepped aside.
  const active = document.activeElement;
  if (active instanceof HTMLElement && (active.matches("input, textarea, select") || active.isContentEditable)) {
    return false;
  }
  // A selection being made or adjusted.
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) return false;
  if (!(target instanceof Element)) return true;
  if (target.closest(NO_SWIPE)) return false;
  for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
    if (scrollsSideways(element)) return false;
  }
  return true;
}

/**
 * Moves to the tab beside the one shown when a finger swipes sideways on a
 * phone (below 880px, where the tab bar is), as in an installed app: left for
 * the next tab, right for the previous one, through `navigate` like a tap on
 * the tab (in place: no page load, Back returns). Listeners are passive and
 * never prevent anything, so scrolling is the browser's as before; a touch
 * that scrolls first, starts at a screen edge (the system's back gesture),
 * on the guess dock or a sideways-scrolling strip, or while typing or a
 * dialog is open, is never a swipe. Registered once: the route is read from
 * a ref, so nothing re-renders for it.
 */
export function useSwipeTabs(route: Route, navigate: (to: Route) => void): void {
  const shown = useRef(route);
  const go = useRef(navigate);
  useEffect(() => {
    shown.current = route;
    go.current = navigate;
  }, [route, navigate]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const phone = window.matchMedia(SWIPE_MEDIA);
    let track: (TouchTrack & { at: number }) | null = null;

    const onStart = (event: TouchEvent) => {
      track = null;
      if (event.touches.length !== 1 || !phone.matches) return;
      const touch = event.touches[0];
      if (!canStartSwipe(event.target, touch.clientX, window.innerWidth)) return;
      track = { x: touch.clientX, y: touch.clientY, scrolling: false, at: event.timeStamp };
    };
    const onMove = (event: TouchEvent) => {
      if (!track || track.scrolling) return;
      if (event.touches.length !== 1) {
        track = null;
        return;
      }
      const touch = event.touches[0];
      if (startsScrolling(touch.clientX - track.x, touch.clientY - track.y)) track.scrolling = true;
    };
    const onEnd = (event: TouchEvent) => {
      const started = track;
      track = null;
      if (!started || started.scrolling || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const direction = readSwipe(touch.clientX - started.x, touch.clientY - started.y, event.timeStamp - started.at);
      if (direction === null) return;
      const tab = swipedTab(shown.current, direction);
      if (tab === null) return;
      const counted = tabEvent(tab);
      if (counted) countClick(counted, { from: "swipe" });
      go.current(tabRoute(tab, shown.current));
    };
    const onCancel = () => {
      track = null;
    };

    const options = { passive: true } as const;
    window.addEventListener("touchstart", onStart, options);
    window.addEventListener("touchmove", onMove, options);
    window.addEventListener("touchend", onEnd, options);
    window.addEventListener("touchcancel", onCancel, options);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, []);
}

import { useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { countClick } from "../analytics";
import { prefersReducedMotion } from "../reducedMotion";
import type { Route } from "../routes";
import { swipedTab, tabEvent, tabRoute, type TabName } from "../tabs";

/** Below this width, the phone's layout and its tab bar (game.css's breakpoint). */
export const SWIPE_MEDIA = "(max-width: 879px)";
/** A quick flick this far sideways moves to the next tab, in CSS pixels. */
export const SWIPE_MIN_DISTANCE = 64;
/** Quicker than this, a release is a flick: SWIPE_MIN_DISTANCE is enough. */
export const SWIPE_MAX_MS = 700;
/** Dragged this share of the screen's width, the screen goes over to the next tab, however slowly. */
export const SWIPE_COMMIT_SHARE = 0.3;
/** Moved this far, a touch says which way it goes: up or down (a scroll), or sideways (a swipe). */
export const SLOP = 10;
/**
 * Touches starting this close to either side of the screen are left alone:
 * Android's back gesture (and Safari's) starts there.
 */
export const EDGE_ZONE = 28;
/** Past the first or the last tab, the screen follows the finger this much, then springs back. */
export const RUBBER_BAND = 0.25;
/** How long the screen takes to leave once let go, and the next one to come in, in ms. */
export const LEAVE_MS = 160;
export const ENTER_MS = 280;
/** How long a screen dragged too little takes to spring back, in ms. */
export const SNAP_BACK_MS = 220;

/**
 * Where a touch can't start a swipe: the guess dock (its input, its buttons,
 * the tour's invitation in its place), a slider, anything editable, and
 * anything marked so. A field merely touched may start one (the room's page
 * is mostly its form); a focused one stops them all (canStartSwipe). A
 * horizontally scrollable element is checked on its own (scrollsSideways).
 */
const NO_SWIPE = 'input[type="range"], [contenteditable], .lyrix-dock, [data-no-swipe]';
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Whether a screen let go after being dragged `dx` sideways in `ms` goes over
 * to the tab beside: dragged far enough, or flicked.
 */
export function commitsSwipe(dx: number, ms: number, width: number): boolean {
  const distance = Math.abs(dx);
  return distance >= width * SWIPE_COMMIT_SHARE || (distance >= SWIPE_MIN_DISTANCE && ms <= SWIPE_MAX_MS);
}

/**
 * Which way a touch that moved by (dx, dy) goes: a scroll if up or down first,
 * a swipe if sideways first, or not known yet.
 */
export function touchAxis(dx: number, dy: number): "scroll" | "swipe" | null {
  if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) return "scroll";
  if (Math.abs(dx) > SLOP) return "swipe";
  return null;
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
  // The tour's invitation, fixed over the dock, waits for its answer (and would be moved with the screen).
  if (document.querySelector(".lyrix-invite")) return false;
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

/** The screen a swipe moves: every screen's `<main>`, between the header and the tab bar. */
function screenElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".lyrix-app > main");
}

/** The motion is shown only where the browser can animate it and the player didn't ask for less. */
function canAnimate(element: HTMLElement | null): element is HTMLElement {
  return element !== null && typeof element.animate === "function" && !prefersReducedMotion();
}

function place(element: HTMLElement, offset: number, width: number): void {
  element.style.transform = `translate3d(${offset}px, 0, 0)`;
  element.style.opacity = String(1 - Math.min(Math.abs(offset) / width, 1) * 0.5);
}

function release(element: HTMLElement): void {
  element.style.transform = "";
  element.style.opacity = "";
  element.style.willChange = "";
}

interface Track {
  x: number;
  y: number;
  at: number;
  axis: "scroll" | "swipe" | null;
  /** The screen being dragged, once the touch goes sideways and motion is shown. */
  screen: HTMLElement | null;
  dx: number;
}

/**
 * Moves to the tab beside the one shown when a finger swipes sideways on a
 * phone (below 880px, where the tab bar is), as in an installed app: left for
 * the next tab, right for the previous one, through `navigate` like a tap on
 * the tab (in place: no page load, Back returns). The screen follows the
 * finger, springs back if let go too soon (or past the first or the last
 * tab), and otherwise slides out, the next one sliding in from the other
 * side; under reduced motion, it just changes. All of it is written to the
 * DOM, never through state. Listeners are passive and never prevent
 * anything, so scrolling is the browser's as before; a touch that scrolls
 * first, starts at a screen edge (the system's back gesture), on the guess
 * dock or a sideways-scrolling strip, or while typing or a dialog is open, is
 * never a swipe. Registered once: the route is read from a ref, so nothing
 * re-renders for it.
 */
export function useSwipeTabs(route: Route, navigate: (to: Route) => void): void {
  const shown = useRef(route);
  const go = useRef(navigate);
  useEffect(() => {
    shown.current = route;
    go.current = navigate;
  }, [route, navigate]);

  // Set by a swipe's navigation: the side the next screen comes in from (1: the right).
  const entering = useRef<1 | -1 | null>(null);
  useLayoutEffect(() => {
    const from = entering.current;
    entering.current = null;
    const element = screenElement();
    if (from === null || !canAnimate(element)) return;
    release(element);
    const offset = from * window.innerWidth;
    element.animate(
      [
        { transform: `translate3d(${offset}px, 0, 0)`, opacity: 0.5 },
        { transform: "translate3d(0, 0, 0)", opacity: 1 },
      ],
      { duration: ENTER_MS, easing: EASE_OUT }
    );
  }, [route]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const phone = window.matchMedia(SWIPE_MEDIA);
    let track: Track | null = null;
    // A screen sliding out or springing back: no new swipe until it is done.
    let settling = false;

    const goTo = (tab: TabName, direction: 1 | -1) => {
      const counted = tabEvent(tab);
      if (counted) countClick(counted, { from: "swipe" });
      entering.current = direction;
      go.current(tabRoute(tab, shown.current));
    };

    const cancel = () => {
      const screen = track?.screen ?? null;
      track = null;
      if (screen) release(screen);
    };

    const onStart = (event: TouchEvent) => {
      cancel();
      if (settling || event.touches.length !== 1 || !phone.matches) return;
      const touch = event.touches[0];
      if (!canStartSwipe(event.target, touch.clientX, window.innerWidth)) return;
      track = { x: touch.clientX, y: touch.clientY, at: event.timeStamp, axis: null, screen: null, dx: 0 };
    };

    const onMove = (event: TouchEvent) => {
      if (!track || track.axis === "scroll") return;
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - track.x;
      if (track.axis === null) {
        track.axis = touchAxis(dx, touch.clientY - track.y);
        if (track.axis !== "swipe") return;
        const screen = screenElement();
        if (canAnimate(screen)) {
          screen.style.willChange = "transform, opacity";
          track.screen = screen;
        }
      }
      track.dx = dx;
      if (!track.screen) return;
      const width = window.innerWidth;
      const beside = swipedTab(shown.current, dx < 0 ? "left" : "right");
      place(track.screen, beside === null ? dx * RUBBER_BAND : dx, width);
    };

    const onEnd = (event: TouchEvent) => {
      const started = track;
      track = null;
      if (!started || started.axis !== "swipe") return;
      const { dx, screen } = started;
      const width = window.innerWidth;
      const direction = dx < 0 ? "left" : "right";
      const tab = commitsSwipe(dx, event.timeStamp - started.at, width) ? swipedTab(shown.current, direction) : null;
      // The next screen comes in from the side the finger moved away from.
      const side = direction === "left" ? 1 : -1;

      if (!screen) {
        if (tab) goTo(tab, side);
        return;
      }
      const from = { transform: screen.style.transform, opacity: screen.style.opacity || "1" };
      settling = true;
      if (tab) {
        const leave = screen.animate(
          [from, { transform: `translate3d(${-side * width}px, 0, 0)`, opacity: 0.5 }],
          { duration: LEAVE_MS, easing: "ease-in", fill: "forwards" }
        );
        let left = false;
        leave.onfinish = leave.oncancel = () => {
          if (left) return;
          left = true;
          settling = false;
          // Rendered at once, so the next screen is in place (and coming in) before the next frame.
          flushSync(() => goTo(tab, side));
          // A screen kept by React (none is today) would otherwise stay off to the side.
          release(screen);
          leave.cancel();
        };
        return;
      }
      release(screen);
      const back = screen.animate([from, { transform: "translate3d(0, 0, 0)", opacity: 1 }], {
        duration: SNAP_BACK_MS,
        easing: EASE_OUT,
      });
      back.onfinish = back.oncancel = () => {
        settling = false;
      };
    };

    const options = { passive: true } as const;
    window.addEventListener("touchstart", onStart, options);
    window.addEventListener("touchmove", onMove, options);
    window.addEventListener("touchend", onEnd, options);
    window.addEventListener("touchcancel", cancel, options);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, []);
}

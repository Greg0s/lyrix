import { useEffect, useRef, type RefObject } from "react";
import { PHONE_LAYOUT_MEDIA } from "../layout";
import { prefersReducedMotion } from "../reducedMotion";

/** Where a sheet is one (Modal's "sheet" variant, game.css): the phone's layout. */
export const SHEET_MEDIA = PHONE_LAYOUT_MEDIA;
/** Moved this far, a touch says which way it goes: down (a drag) or anything else (left to the browser). */
export const DRAG_SLOP = 10;
/** Dragged down this share of its height, a sheet closes when let go, however slowly. */
export const DISMISS_SHARE = 0.3;
/** Let go moving down at least this fast (CSS pixels per ms), a sheet closes: a flick. */
export const FLICK_SPEED = 0.5;
/** A flick still has to have moved the sheet this far, so a twitch on a tap closes nothing. */
export const FLICK_MIN_DISTANCE = 24;
/** Let go moving back up at least this fast, a sheet stays, however far it was dragged. */
export const RAISE_SPEED = 0.2;
/** How long a sheet dragged too little takes to spring back, in ms. */
export const SNAP_BACK_MS = 220;
/** How long a sheet let go takes, at the most and at the least, to leave the screen, in ms. */
export const DISMISS_MAX_MS = 240;
export const DISMISS_MIN_MS = 120;

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Where a touch drags the sheet wherever its content is scrolled: the grip and the title's row. */
const DRAG_ZONE = ".lyrix-sheet-grip, .lyrix-modal-header";

/**
 * Whether a sheet let go `dy` pixels down, moving at `velocity` (pixels per
 * ms, down positive), closes: dragged far enough and not being raised back
 * up, or flicked down.
 */
export function dismissesSheet(dy: number, velocity: number, height: number): boolean {
  if (velocity <= -RAISE_SPEED) return false;
  if (velocity >= FLICK_SPEED && dy >= FLICK_MIN_DISTANCE) return true;
  return height > 0 && dy >= height * DISMISS_SHARE;
}

/**
 * Whether a touch starting on `target` may drag the sheet `panel` down: from
 * its grip or its title's row, always; from its content, only while nothing
 * between the finger and the sheet is scrolled down, so the finger first
 * scrolls the content back to its top, as in an app.
 */
export function canStartDrag(target: EventTarget | null, panel: HTMLElement): boolean {
  if (!(target instanceof Element) || !panel.contains(target)) return false;
  if (target.closest(DRAG_ZONE)) return true;
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element.scrollTop > 0) return false;
    if (element === panel) break;
  }
  return true;
}

function canAnimate(element: HTMLElement): boolean {
  return typeof element.animate === "function" && !prefersReducedMotion();
}

function release(...elements: (HTMLElement | null)[]): void {
  for (const element of elements) {
    if (!element) continue;
    element.style.transform = "";
    element.style.opacity = "";
    element.style.willChange = "";
  }
}

interface Drag {
  x: number;
  y: number;
  axis: "drag" | "other" | null;
  /** Whether the sheet follows the finger: it does unless motion is reduced (or can't be shown). */
  follows: boolean;
  dy: number;
  /** The two last positions, for the speed the finger let go at. */
  last: { dy: number; at: number };
  previous: { dy: number; at: number };
}

/**
 * Lets a finger pull a sheet (Modal's "sheet" variant, on a phone) down off
 * the screen, as a native bottom sheet: from its grip or its title's row, or
 * from its content once that is scrolled to its top. The sheet follows the
 * finger and its backdrop fades with it; let go far enough down, or flicked,
 * it slides out and `onDismissed` is called once it is gone; else it springs
 * back. Under reduced motion it doesn't follow: let go far enough, it closes
 * at once. All of it is written to the DOM, never through state, so nothing
 * re-renders while dragging.
 *
 * A touch going up or sideways first is left to the browser (a scroll). Only
 * a drag down is kept from it (a non-passive touchmove), or the content would
 * scroll or Chrome refresh the page under the sheet. The sideways swipe
 * between tabs (useSwipeTabs) never starts over a dialog, so the two never
 * meet.
 */
export function useSheetDrag(
  panelRef: RefObject<HTMLElement | null>,
  backdropRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onDismissed: () => void
): void {
  const dismissed = useRef(onDismissed);
  useEffect(() => {
    dismissed.current = onDismissed;
  }, [onDismissed]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!enabled || !panel || typeof window.matchMedia !== "function") return;
    const sheet = window.matchMedia(SHEET_MEDIA);
    const backdrop = backdropRef.current;
    let drag: Drag | null = null;
    // Sliding out or springing back: no new drag until it is done.
    let settling = false;

    const place = (dy: number) => {
      panel.style.transform = `translate3d(0, ${dy}px, 0)`;
      if (backdrop) backdrop.style.opacity = String(1 - Math.min(dy / Math.max(panel.offsetHeight, 1), 1));
    };

    const springBack = () => {
      const from = panel.style.transform;
      const fromOpacity = backdrop?.style.opacity || "1";
      release(panel, backdrop);
      if (!from || !canAnimate(panel)) return;
      settling = true;
      const back = panel.animate([{ transform: from }, { transform: "translate3d(0, 0, 0)" }], {
        duration: SNAP_BACK_MS,
        easing: EASE_OUT,
      });
      backdrop?.animate([{ opacity: fromOpacity }, { opacity: 1 }], { duration: SNAP_BACK_MS, easing: EASE_OUT });
      back.onfinish = back.oncancel = () => {
        settling = false;
      };
    };

    const dismiss = (dy: number, velocity: number, follows: boolean) => {
      if (!follows || !canAnimate(panel)) {
        release(panel, backdrop);
        dismissed.current();
        return;
      }
      settling = true;
      const height = panel.offsetHeight;
      const speed = Math.max(velocity, 1);
      const duration = Math.min(Math.max((height - dy) / speed, DISMISS_MIN_MS), DISMISS_MAX_MS);
      const from = panel.style.transform;
      const fromOpacity = backdrop?.style.opacity || "1";
      const options = { duration, easing: "ease-in", fill: "forwards" } as const;
      const out = panel.animate([{ transform: from }, { transform: "translate3d(0, 100%, 0)" }], options);
      backdrop?.animate([{ opacity: fromOpacity }, { opacity: 0 }], options);
      let done = false;
      out.onfinish = out.oncancel = () => {
        if (done) return;
        done = true;
        dismissed.current();
      };
    };

    const onStart = (event: TouchEvent) => {
      drag = null;
      if (settling || event.touches.length !== 1 || !sheet.matches) return;
      // Already closing (its ✕, Escape, Back): it leaves on its own.
      if (panel.closest(".is-closing")) return;
      if (!canStartDrag(event.target, panel)) return;
      const touch = event.touches[0];
      const start = { dy: 0, at: event.timeStamp };
      drag = {
        x: touch.clientX,
        y: touch.clientY,
        axis: null,
        follows: canAnimate(panel),
        dy: 0,
        last: start,
        previous: start,
      };
    };

    const onMove = (event: TouchEvent) => {
      if (!drag || drag.axis === "other") return;
      if (event.touches.length !== 1) {
        drag = null;
        springBack();
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - drag.x;
      const dy = touch.clientY - drag.y;
      if (drag.axis === null) {
        const down = dy > 0 && dy >= Math.abs(dx);
        if (!down && Math.max(Math.abs(dx), Math.abs(dy)) > DRAG_SLOP) {
          drag.axis = "other";
          return;
        }
        // Down, even before it is sure: the content at its top would rubber-band, Chrome would refresh.
        if (down && event.cancelable) event.preventDefault();
        if (!down || dy <= DRAG_SLOP) return;
        drag.axis = "drag";
        if (drag.follows) panel.style.willChange = "transform";
      }
      if (event.cancelable) event.preventDefault();
      // Followed down, never up past where it sits.
      drag.dy = Math.max(dy, 0);
      drag.previous = drag.last;
      drag.last = { dy: drag.dy, at: event.timeStamp };
      if (drag.follows) place(drag.dy);
    };

    const onEnd = (event: TouchEvent) => {
      const ended = drag;
      if (!ended || ended.axis !== "drag") {
        drag = null;
        return;
      }
      const elapsed = ended.last.at - ended.previous.at;
      const velocity = elapsed > 0 ? (ended.last.dy - ended.previous.dy) / elapsed : 0;
      if (event.type === "touchend" && dismissesSheet(ended.dy, velocity, panel.offsetHeight)) {
        dismiss(ended.dy, velocity, ended.follows);
      } else {
        springBack();
      }
      drag = null;
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [panelRef, backdropRef, enabled]);
}

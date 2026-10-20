/** The CSS variable the side column's sticky offset reads its own height from (game.css). */
export const STICKY_HEIGHT_VAR = "--sticky-height";

/**
 * A ref callback keeping `--sticky-height` on an element in step with its
 * height, so a sticky column taller than the screen can stick by its bottom
 * instead of being cut off, or scrolling on its own (game.css, `.lyrix-aside`).
 * Written straight to the element's style: a resize re-renders nothing.
 * Without ResizeObserver (jsdom), the variable is never set and the column
 * sticks by its top, as it does when it fits.
 */
export function trackStickyHeight(element: HTMLElement | null): (() => void) | undefined {
  if (!element || typeof ResizeObserver === "undefined") return undefined;
  const observer = new ResizeObserver(() => {
    element.style.setProperty(STICKY_HEIGHT_VAR, `${element.offsetHeight}px`);
  });
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Whether the player asked their system for reduced motion. For the motion a
 * component decides on in script: global.css's reduced-motion rule only
 * shortens CSS animations, it can't skip a step that waits on one.
 */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "../reducedMotion";
import { placeTip, spotlightBox, TOUR_STEPS, type TourStep } from "../tour";

interface ProductTourProps {
  /** The player went through every step, or skipped the rest ("Passer", Escape). */
  onDone: () => void;
}

function targetOf(step: TourStep): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
}

/**
 * The guided tour shown once to a first-time player (src/tour.ts,
 * src/tourStorage.ts): the screen dimmed but for one element at a time, a tip
 * next to it, "Passer" on every step. Portalled into <body>, like the
 * confetti, so no card's transform moves its fixed layers.
 *
 * Where the highlight and the tip go is written straight to their style, never
 * through React state: following a scroll or a resize re-renders nothing.
 * Memoized on a stable `onDone`, so typing a guess behind it re-renders
 * nothing either.
 */
export const ProductTour = memo(function ProductTour({ onDone }: ProductTourProps) {
  // Fixed when the tour starts: the steps whose element is on screen. Read
  // once the page is committed, since the tour mounts in the same render as
  // the round it points at, before paint all the same.
  const [steps, setSteps] = useState<readonly TourStep[] | null>(null);
  useLayoutEffect(() => setSteps(TOUR_STEPS.filter((step) => targetOf(step) !== null)), []);
  const [index, setIndex] = useState(0);
  const step = steps?.[index];
  const last = steps !== null && index === steps.length - 1;
  const spotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (steps?.length === 0) onDone();
  }, [steps, onDone]);

  const place = useCallback(() => {
    const target = step ? targetOf(step) : null;
    const spot = spotRef.current;
    const tip = tipRef.current;
    if (!target || !spot || !tip) return;
    // clientWidth: the page's width without its scrollbar, which the tip must not sit under.
    const viewport = { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
    const rect = target.getBoundingClientRect();
    const box = spotlightBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height }, viewport);
    spot.style.top = `${box.top}px`;
    spot.style.left = `${box.left}px`;
    spot.style.width = `${box.width}px`;
    spot.style.height = `${box.height}px`;
    const placement = placeTip(box, { width: tip.offsetWidth, height: tip.offsetHeight }, viewport);
    tip.style.top = `${placement.top}px`;
    tip.style.left = `${placement.left}px`;
    tip.style.setProperty("--tour-arrow-left", `${placement.arrowLeft}px`);
    tip.dataset.side = placement.side;
  }, [step]);

  // Each step: its element brought into view, the tip next to it before the
  // first paint, and focus on the button that goes on.
  useLayoutEffect(() => {
    if (!step) return;
    const target = targetOf(step);
    if (step.scroll && typeof target?.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    place();
    primaryRef.current?.focus({ preventScroll: true });
  }, [step, place]);

  // And it follows the page: a smooth scroll on its way, a resize, a phone turned.
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    const target = step ? targetOf(step) : null;
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    if (target) observer?.observe(target);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [step, place]);

  // Escape skips, like "Passer"; Tab stays within the tip, the page behind being out of reach.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onDone();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = [...(tipRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : at === buttons.length - 1 ? 0 : at + 1;
    event.preventDefault();
    buttons[next]?.focus();
  };

  if (!steps || !step) return null;
  return createPortal(
    <div className="lyrix-tour">
      {/* Takes every click meant for the page behind, and keeps focus in the tip. */}
      <div className="lyrix-tour-catcher" onMouseDown={(event) => event.preventDefault()} />
      <div className="lyrix-tour-spotlight" ref={spotRef} aria-hidden="true" />
      <div
        ref={tipRef}
        className="lyrix-tour-tip"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
      >
        {/* A new key per step, so its entrance plays again. */}
        <div className="lyrix-tour-content" key={index}>
          <p className="lyrix-tour-count">
            Étape {index + 1} sur {steps.length}
          </p>
          <h2 className="lyrix-tour-title" id={titleId}>
            {step.title}
          </h2>
          <p className="lyrix-tour-body" id={bodyId}>
            {step.body}
          </p>
        </div>
        <div className="lyrix-tour-actions">
          <button type="button" className="lyrix-tour-skip" onClick={onDone}>
            Passer
          </button>
          <div className="lyrix-tour-nav">
            {index > 0 ? (
              <button type="button" className="lyrix-tour-back" onClick={() => setIndex(index - 1)}>
                Précédent
              </button>
            ) : null}
            <button
              ref={primaryRef}
              type="button"
              className="lyrix-tour-next"
              onClick={last ? onDone : () => setIndex(index + 1)}
            >
              {last ? "C'est parti\u00a0!" : "Suivant"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

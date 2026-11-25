import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useBackCloses } from "../hooks/useBackCloses";
import { useSheetDrag } from "../hooks/useSheetDrag";

/** How long the closing animation (lyrix-panel-out, lyrix-fade-out) runs before the modal is unmounted. */
export const MODAL_CLOSE_MS = 180;

interface ModalProps {
  title: string;
  /** Called once the closing animation is over: the parent unmounts the modal and puts focus back where it belongs. */
  onClosed: () => void;
  size?: "narrow" | "wide";
  /**
   * "sheet": in the phone's layout, slides up from the bottom of the screen
   * instead of sitting in its middle (game.css), under a grip a finger pulls
   * it back down by (useSheetDrag), its title's row staying while its content
   * scrolls.
   */
  variant?: "sheet";
  /** Given the modal's own close request, for a button inside the body that dismisses it. */
  children: (requestClose: () => void) => ReactNode;
}

/**
 * A centered dialog over a dimmed backdrop. Closes on Escape, a click on the
 * backdrop, the ✕ button or Back (useBackCloses: Android's Back button closes
 * a sheet, as in an app), each time with a short exit animation first; a
 * sheet also when a finger pulls it down off the screen.
 * Mount it only while it is open; it takes focus when it mounts.
 */
export function Modal({ title, onClosed, size = "narrow", variant, children }: ModalProps) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const requestClose = useCallback(() => setClosing(true), []);
  useBackCloses(requestClose);
  // Pulled down off the screen, it has already left: no exit animation to wait for.
  useSheetDrag(panelRef, backdropRef, variant === "sheet", onClosed);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClosed, MODAL_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [closing, onClosed]);

  return (
    <div
      ref={backdropRef}
      className={`lyrix-modal-backdrop${variant ? ` is-${variant}` : ""}${closing ? " is-closing" : ""}`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        className={`lyrix-modal is-${size}${variant ? ` is-${variant}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {variant === "sheet" ? <div className="lyrix-sheet-grip" aria-hidden="true" /> : null}
        <div className="lyrix-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="lyrix-modal-close" onClick={requestClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {variant === "sheet" ? (
          <div className="lyrix-modal-body">{children(requestClose)}</div>
        ) : (
          children(requestClose)
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

/** How long the closing animation (lyrix-panel-out, lyrix-fade-out) runs before the modal is unmounted. */
export const MODAL_CLOSE_MS = 180;

interface ModalProps {
  title: string;
  /** Called once the closing animation is over: the parent unmounts the modal and puts focus back where it belongs. */
  onClosed: () => void;
  size?: "narrow" | "wide";
  /** Given the modal's own close request, for a button inside the body that dismisses it. */
  children: (requestClose: () => void) => ReactNode;
}

/**
 * A centered dialog over a dimmed backdrop. Closes on Escape, a click on the
 * backdrop or the ✕ button, each time with a short exit animation first.
 * Mount it only while it is open; it takes focus when it mounts.
 */
export function Modal({ title, onClosed, size = "narrow", children }: ModalProps) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const requestClose = useCallback(() => setClosing(true), []);

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
    <div className={`lyrix-modal-backdrop${closing ? " is-closing" : ""}`} onClick={requestClose}>
      <div
        ref={panelRef}
        className={`lyrix-modal is-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lyrix-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="lyrix-modal-close" onClick={requestClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {children(requestClose)}
      </div>
    </div>
  );
}

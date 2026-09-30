import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CELEBRATION_MS, confettiPieces, type ConfettiPiece } from "./confetti";

/** How many pieces one burst throws. */
const PIECE_COUNT = 80;

/**
 * Asked here rather than left to global.css: its reduced-motion rule only
 * shortens CSS animations, and under it there must be no confetti at all.
 */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A piece's own flight, as the custom properties game.css animates it with. */
function flightStyle(piece: ConfettiPiece): CSSProperties {
  return {
    left: `${piece.x * 100}%`,
    "--dx": `${piece.dx}vw`,
    "--rise": `${piece.rise}vh`,
    "--fall": `${piece.fall}vh`,
    "--spin": `${piece.spin}deg`,
    "--flip": `${piece.flip}ms`,
    "--delay": `${piece.delay}ms`,
    "--time": `${piece.time}ms`,
  } as CSSProperties;
}

/**
 * Lays the burst along the title line, where it is on screen, but never out
 * of it: a player who has scrolled down into the lyrics still sees the
 * confetti come down from the top.
 */
function placeBurst(burst: HTMLElement, title: DOMRect): void {
  const left = Math.max(title.left, 0);
  const right = Math.min(title.right, window.innerWidth);
  const middle = title.top + title.height / 2;
  burst.style.left = `${left}px`;
  burst.style.width = `${Math.max(right - left, 0)}px`;
  burst.style.top = `${Math.min(Math.max(middle, window.innerHeight * 0.1), window.innerHeight * 0.6)}px`;
}

interface CelebrationProps {
  /** The title line the confetti bursts from. */
  from: RefObject<HTMLElement | null>;
}

/**
 * The win's confetti: one burst in the accent palette from the title, which
 * falls, fades out, and leaves the DOM. TitleGuess mounts it only when a guess
 * of the player's own completes the title (useGame's `celebration`), never
 * for a round that comes back already won.
 *
 * Everything it does is its own: pieces drawn once, one timer to take the
 * layer away, CSS animations for the rest, so it re-renders nothing but
 * itself. The layer is fixed over the page and lets every click through (the
 * guess dock, the "show all lyrics" checkbox, the header), and screen readers
 * never meet it: the victory text is what they read. Under reduced motion
 * there is no burst at all, not a shorter one.
 */
export const Celebration = memo(function Celebration({ from }: CelebrationProps) {
  // The pieces in flight: null once they have all landed, or from the start under reduced motion.
  const [pieces, setPieces] = useState(() => (prefersReducedMotion() ? null : confettiPieces(PIECE_COUNT)));
  const burstRef = useRef<HTMLDivElement>(null);
  const playing = pieces !== null;

  // Before the first paint, so no piece is ever drawn anywhere but on the title.
  useLayoutEffect(() => {
    const burst = burstRef.current;
    const title = from.current;
    if (burst && title) placeBurst(burst, title.getBoundingClientRect());
  }, [from]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPieces(null), CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [playing]);

  if (!pieces) return null;
  // Into <body>: the song card keeps the transform its entrance animation
  // ends on, and `position: fixed` inside a transformed element is fixed to
  // that element, not to the screen.
  return createPortal(
    <div className="lyrix-confetti" aria-hidden="true">
      <div className="lyrix-confetti-burst" ref={burstRef}>
        {pieces.map((piece, index) => (
          <span key={index} className="lyrix-confetti-piece" style={flightStyle(piece)}>
            <span className={`lyrix-confetti-paper is-${piece.shape} tone-${piece.tone}`} />
          </span>
        ))}
      </div>
    </div>,
    document.body
  );
});

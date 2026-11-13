import { memo, useEffect, useId, useRef, useState } from "react";
import { prefersReducedMotion } from "../reducedMotion";
import { INVITE_LEAVE_MS } from "../tour";

interface TourInviteProps {
  /** "Faire la visite": the guided tour (ProductTour) starts. */
  onStart: () => void;
  /** "Non merci, je joue": the guess dock comes back, and the tour is never offered again. */
  onSkip: () => void;
}

/**
 * The invitation to the guided tour, shown once to a first-time player in the
 * guess dock's place (decided with the developer): the whole screen stays in
 * view, nothing is dimmed, and no word can be typed before an answer, so it is
 * always read. It slides in a moment after the round (game.css), the screen
 * being seen first, and slides back out once answered, before the answer takes
 * effect: the dock, or the tour, comes in after it.
 */
export const TourInvite = memo(function TourInvite({ onStart, onSkip }: TourInviteProps) {
  const titleId = useId();
  const bodyId = useId();
  const startRef = useRef<HTMLButtonElement>(null);

  // The answer given, waiting for the exit animation to end before it takes effect.
  const [answer, setAnswer] = useState<(() => void) | null>(null);

  // Focus where the input would have had it: Enter takes the tour.
  useEffect(() => startRef.current?.focus({ preventScroll: true }), []);

  // Timed rather than on animationend, which a tab in the background may never fire.
  useEffect(() => {
    if (!answer) return;
    const timer = window.setTimeout(answer, INVITE_LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [answer]);

  const choose = (then: () => void) => {
    if (answer) return;
    if (prefersReducedMotion()) then();
    else setAnswer(() => then);
  };

  return (
    <section className="lyrix-dock lyrix-invite" aria-labelledby={titleId} aria-describedby={bodyId}>
      <div className={`lyrix-invite-panel${answer ? " is-answered" : ""}`}>
        <p className="lyrix-invite-kicker">Avant de commencer</p>
        <h2 className="lyrix-invite-title" id={titleId}>
          Première fois sur Lyrix&nbsp;?
        </h2>
        <p className="lyrix-invite-body" id={bodyId}>
          Je te fais faire le tour de l'écran en une minute&nbsp;: où chercher, quoi taper, comment lire les indices.
        </p>
        <div className="lyrix-invite-actions">
          <button ref={startRef} type="button" className="lyrix-invite-start" onClick={() => choose(onStart)}>
            Faire la visite
          </button>
          <button type="button" className="lyrix-invite-skip" onClick={() => choose(onSkip)}>
            Non merci, je joue
          </button>
        </div>
      </div>
    </section>
  );
});

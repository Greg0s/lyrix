import { memo, useEffect, useId, useRef } from "react";

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
 * always read. It comes in a moment after the round (game.css), the screen
 * being seen first.
 */
export const TourInvite = memo(function TourInvite({ onStart, onSkip }: TourInviteProps) {
  const titleId = useId();
  const bodyId = useId();
  const startRef = useRef<HTMLButtonElement>(null);

  // Focus where the input would have had it: Enter takes the tour.
  useEffect(() => startRef.current?.focus({ preventScroll: true }), []);

  return (
    <section className="lyrix-dock lyrix-invite" aria-labelledby={titleId} aria-describedby={bodyId}>
      <div className="lyrix-invite-panel">
        <p className="lyrix-invite-kicker">Avant de commencer</p>
        <h2 className="lyrix-invite-title" id={titleId}>
          Première fois sur Lyrix&nbsp;?
        </h2>
        <p className="lyrix-invite-body" id={bodyId}>
          Je te fais faire le tour de l'écran en une minute&nbsp;: où chercher, quoi taper, comment lire les indices.
        </p>
        <div className="lyrix-invite-actions">
          <button ref={startRef} type="button" className="lyrix-invite-start" onClick={onStart}>
            Faire la visite
          </button>
          <button type="button" className="lyrix-invite-skip" onClick={onSkip}>
            Non merci, je joue
          </button>
        </div>
      </div>
    </section>
  );
});

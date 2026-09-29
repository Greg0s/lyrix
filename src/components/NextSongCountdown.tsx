import { useEffect, useState } from "react";
import { formatCountdown, msUntilNextSong } from "../game/daily";

/**
 * Time left until tomorrow's song, shown once the round is won. It ticks every
 * second on its own local state, so only this line re-renders, never the lyrics.
 */
export function NextSongCountdown() {
  // Fixed at mount: the song the player just solved is today's, and it only
  // changes once, at the next UTC midnight.
  const [deadline] = useState(() => Date.now() + msUntilNextSong(Date.now()));
  const [remaining, setRemaining] = useState(() => deadline - Date.now());
  const done = remaining <= 0;

  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => setRemaining(deadline - Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline, done]);

  if (done) {
    return (
      <p className="lyrix-victory-note">
        La nouvelle chanson est prête&nbsp;!{" "}
        <button type="button" className="lyrix-link-button" onClick={() => window.location.reload()}>
          Jouer
        </button>
      </p>
    );
  }

  return (
    <p className="lyrix-victory-note">
      Prochaine chanson dans <span className="lyrix-countdown">{formatCountdown(remaining)}</span>
    </p>
  );
}

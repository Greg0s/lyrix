import { memo, useEffect, useState } from "react";
import { msUntilNextSong, utcDay } from "../game/daily";

/**
 * How far a device's clock may run ahead of the Worker's before the notice
 * trusts it: a minute early, the new song isn't out yet, and "Jouer la
 * nouvelle" would reload the same round.
 */
export const CLOCK_GRACE_MS = 2 * 60 * 1000;

/** The day the Worker is surely on by now. */
function workerDay(): string {
  return utcDay(new Date(Date.now() - CLOCK_GRACE_MS));
}

interface NewSongNoticeProps {
  /** The day of the round on screen, as the Worker named it. */
  roundDay: string;
}

/**
 * Today's round, still on screen once that day is over: a tab left open past
 * UTC midnight went on with the day before's song without a word (only a
 * winner had the countdown's "Jouer"). It says so, and offers the new song;
 * what was found stays in the archives, under its own day.
 *
 * Its clock is its own state, ticked at midnight and when the tab comes back
 * into view (a sleeping device's timers are late), so nothing else re-renders.
 */
export const NewSongNotice = memo(function NewSongNotice({ roundDay }: NewSongNoticeProps) {
  const [today, setToday] = useState(workerDay);

  useEffect(() => {
    const check = () => setToday(workerDay());
    // Just past midnight and the grace, so the day has changed when it fires.
    const timer = window.setTimeout(check, msUntilNextSong(Date.now() - CLOCK_GRACE_MS) + 1_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [today]);

  if (today <= roundDay) return null;
  return (
    <section className="lyrix-card lyrix-group-found lyrix-new-song" aria-label="Nouvelle chanson">
      <p className="lyrix-group-found-text" role="status">
        <span>
          <strong>La chanson du jour a changé&nbsp;!</strong> Celle-ci reste dans les archives, avec ce que tu y as
          trouvé.
        </span>
      </p>
      <button type="button" className="lyrix-button is-accent" onClick={() => window.location.reload()}>
        Jouer la nouvelle
      </button>
    </section>
  );
});

import { capitalize, longDayLabel } from "../game/frenchDates";
import { ChevronIcon } from "./ChevronIcon";

interface VictoryFootProps {
  /** The day of the archives the round won is the song of; null for today's song. */
  archiveDay: string | null;
  /** How many past days of the archives are still to find. */
  daysLeft: number;
  /** The day the archives suggest next. */
  nextDay: string | null;
  onOpenArchives: () => void;
  onPlayDay: (day: string) => void;
}

/**
 * Under a won round, where to go next. After today's song, the days of the
 * archives still to find, if any; after one of theirs, the next of them.
 */
export function VictoryFoot({
  archiveDay,
  daysLeft,
  nextDay,
  onOpenArchives,
  onPlayDay,
}: VictoryFootProps) {
  if (archiveDay === null) {
    if (daysLeft === 0) return null;
    return (
      <div className="lyrix-victory-foot">
        <p className="lyrix-victory-foot-text">
          En attendant, {daysLeft} {daysLeft > 1 ? "chansons" : "chanson"} des 30 derniers jours{" "}
          {daysLeft > 1 ? "t'attendent" : "t'attend"}.
        </p>
        <button type="button" className="lyrix-button is-accent" onClick={onOpenArchives}>
          Voir les archives
        </button>
      </div>
    );
  }
  return (
    <div className="lyrix-victory-foot">
      {nextDay ? (
        <p className="lyrix-victory-next">
          <span className="lyrix-victory-next-label">Chanson suivante à trouver</span>
          <span className="lyrix-victory-next-day">{capitalize(longDayLabel(nextDay))}</span>
        </p>
      ) : (
        <p className="lyrix-victory-foot-text">Tu as trouvé toutes les chansons des 30 derniers jours&nbsp;!</p>
      )}
      <div className="lyrix-victory-actions">
        <button type="button" className="lyrix-button is-ghost" onClick={onOpenArchives}>
          Toutes les archives
        </button>
        {nextDay ? (
          <button
            type="button"
            className="lyrix-button is-accent lyrix-victory-play"
            onClick={() => onPlayDay(nextDay)}
            aria-label={`Jouer la chanson du ${longDayLabel(nextDay)}`}
          >
            Jouer
            <ChevronIcon direction="forward" size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

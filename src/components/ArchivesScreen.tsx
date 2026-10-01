import { useState } from "react";
import { archiveOverview } from "../game/archive";
import { flushSavedRound, loadArchive } from "../roundStorage";
import { TODAY, type Route } from "../routes";
import { ArchiveCover } from "./ArchiveCover";
import { ChevronIcon } from "./ChevronIcon";
import { RouteLink } from "./RouteLink";

interface ArchivesScreenProps {
  onNavigate: (to: Route) => void;
}

/**
 * The last 30 days as a collection (the "Lyrix Archives" mockup, 1c): every
 * song found is a cover, every day still to play an empty slot. Built from
 * what this browser saved (loadArchive), with no network call: nothing of a
 * song the player hasn't found ever reaches this screen.
 */
export function ArchivesScreen({ onNavigate }: ArchivesScreenProps) {
  // Read once, as the screen opens: a guess still waiting to be written
  // (saveRoundSoon) goes first, so today's cover shows where the player is.
  const [overview] = useState(() => {
    flushSavedRound();
    return archiveOverview(loadArchive());
  });

  return (
    <main className="lyrix-archives">
      <div className="lyrix-archives-head">
        <RouteLink to={TODAY} onNavigate={onNavigate} className="lyrix-back-link">
          <ChevronIcon direction="back" size={16} />
          Chanson du jour
        </RouteLink>
        <div className="lyrix-archives-heading">
          <div className="lyrix-archives-intro">
            <h1 className="lyrix-archives-title">Les 30 derniers jours</h1>
            <p className="lyrix-archives-lede">
              Chaque chanson trouvée rejoint ta collection. Les emplacements vides t'attendent encore&nbsp;; tes parties
              sont enregistrées sur cet appareil.
            </p>
          </div>
          <p className="lyrix-archives-count">
            <span className="sr-only">
              {overview.solved} {overview.solved > 1 ? "chansons trouvées" : "chanson trouvée"} sur {overview.playable}
            </span>
            <span className="lyrix-archives-solved" aria-hidden="true">
              {overview.solved}
            </span>
            <span className="lyrix-archives-of" aria-hidden="true">
              <span className="lyrix-archives-total">/&nbsp;{overview.playable}</span>
              <span>{overview.solved > 1 ? "trouvées" : "trouvée"}</span>
            </span>
          </p>
        </div>
      </div>
      <ul className="lyrix-covers">
        {overview.days.map((archived) => (
          <li key={archived.day}>
            <ArchiveCover archived={archived} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </main>
  );
}

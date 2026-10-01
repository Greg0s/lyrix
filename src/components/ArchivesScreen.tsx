import { useMemo, useState } from "react";
import { archiveOverview, withGroupDays, type ArchiveEntry } from "../game/archive";
import { flushSavedRound, loadArchive } from "../roundStorage";
import { TODAY, type Route } from "../routes";
import { ArchiveCover } from "./ArchiveCover";
import { ChevronIcon } from "./ChevronIcon";
import { RouteLink } from "./RouteLink";

interface ArchivesScreenProps {
  onNavigate: (to: Route) => void;
  /** In a room: the days it played, as this player may see them (groupEntry). Null out of a room. */
  group: Readonly<Record<string, ArchiveEntry>> | null;
}

/**
 * The last 30 days as a collection (the "Lyrix Archives" mockup, 1c): every
 * song found is a cover, every day still to play an empty slot. Built from
 * what this browser saved (loadArchive), with no network call: nothing of a
 * song the player hasn't found ever reaches this screen.
 */
export function ArchivesScreen({ onNavigate, group }: ArchivesScreenProps) {
  // Read once, as the screen opens: a guess still waiting to be written
  // (saveRoundSoon) goes first, so today's cover shows where the player is.
  const [own] = useState(() => {
    flushSavedRound();
    return loadArchive();
  });
  // In a room, the group's collection: each day as far as the player got, alone or together.
  const overview = useMemo(() => archiveOverview(group ? withGroupDays(own, group) : own), [own, group]);

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
              {group
                ? "Ta collection et celle du salon. Choisir un jour y emmène tout le groupe."
                : "Chaque chanson trouvée rejoint ta collection. Les emplacements vides t'attendent encore\u00a0; tes parties sont enregistrées sur cet appareil."}
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

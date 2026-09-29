import { memo } from "react";
import { memberName, type RoomMember } from "../game/room";
import { playerStyle } from "./playerColor";

interface GroupFoundBannerProps {
  /** The member who completed the title for the group. */
  winner: RoomMember;
  you: string | null;
  onReveal: () => void;
}

/**
 * Shown to a room member when the group found the song without them (#30).
 * The answer stays hidden: they keep looking on their own solo round, which
 * starts from everything the group found but the winning word, until they
 * find it or choose to see it.
 */
export const GroupFoundBanner = memo(function GroupFoundBanner({ winner, you, onReveal }: GroupFoundBannerProps) {
  return (
    <section className="lyrix-card lyrix-group-found" aria-label="Le groupe a trouvé">
      <p className="lyrix-group-found-text" role="status">
        <span className="lyrix-player-dot" style={playerStyle(winner, you)} aria-hidden="true" />
        <span>
          <strong>{memberName(winner, you)} a trouvé la chanson pour le groupe&nbsp;!</strong> Continue à chercher de
          ton côté&nbsp;: le mot gagnant est encore caché pour toi.
        </span>
      </p>
      <button type="button" className="lyrix-button is-accent" onClick={onReveal}>
        Afficher la réponse
      </button>
    </section>
  );
});

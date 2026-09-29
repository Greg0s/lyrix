import { memo } from "react";
import { playerCountLabel } from "../game/room";
import type { RoomView } from "../hooks/useRoom";
import { CopyCodeButton } from "./CopyCodeButton";
import { RoomMembers } from "./RoomMembers";

interface RoomCardProps {
  room: RoomView;
  onLeave: () => void;
}

/**
 * The dark "Salon" card at the top of the side column while the player is in
 * a room: its code to share, who is there, and the way out. Memoized: the
 * room only changes when someone arrives or leaves, never on a keystroke.
 */
export const RoomCard = memo(function RoomCard({ room, onLeave }: RoomCardProps) {
  return (
    <section className="lyrix-card lyrix-room" aria-label="Salon">
      <div className="lyrix-room-head">
        <h2 className="lyrix-card-title">Salon</h2>
        <span className="lyrix-room-count">{playerCountLabel(room.members.length)}</span>
      </div>
      <div className="lyrix-room-code-row">
        <span className="lyrix-room-code">{room.code}</span>
        <CopyCodeButton code={room.code} tone="dark" />
      </div>
      <RoomMembers room={room} variant="grid" />
      <p className={`lyrix-room-waiting${room.connected ? "" : " is-offline"}`} role="status">
        {room.connected ? "En attente de joueurs…" : "Connexion au salon perdue, nouvelle tentative…"}
      </p>
      <button type="button" className="lyrix-room-leave" onClick={onLeave}>
        Quitter le salon
      </button>
    </section>
  );
});

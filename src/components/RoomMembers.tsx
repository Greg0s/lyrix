import { memo } from "react";
import { memberName, type RoomMember } from "../game/room";
import type { RoomView } from "../hooks/useRoom";
import { playerStyle } from "./playerColor";

function initial(name: string): string {
  return (Array.from(name)[0] ?? "?").toLocaleUpperCase("fr");
}

interface PlayerAvatarProps {
  member: RoomMember;
  you: string;
}

/** A round badge with the player's initial, in the player's colour. Decorative: the name sits next to it. */
export function PlayerAvatar({ member, you }: PlayerAvatarProps) {
  return (
    <span className="lyrix-avatar" style={playerStyle(member, you)} aria-hidden="true">
      {initial(memberName(member, you))}
    </span>
  );
}

interface RoomMembersProps {
  room: RoomView;
  /** "list" in the dialog, one per row; "grid" on the Salon card, two per row. */
  variant: "list" | "grid";
  /** A pulsing placeholder row at the end, for the players still to come. */
  waiting?: boolean;
}

/** The room's connected players, in arrival order, the local one tagged "toi" and the host "hôte". */
export const RoomMembers = memo(function RoomMembers({ room, variant, waiting = false }: RoomMembersProps) {
  return (
    <ul className={`lyrix-members is-${variant}`}>
      {room.members.map((member) => (
        <li key={member.id} className="lyrix-member">
          <PlayerAvatar member={member} you={room.you} />
          {/* On the card's narrow grid, the tags wrap under the name rather than squeeze it out (game.css). */}
          <span className="lyrix-member-text">
            <span className="lyrix-member-name">{memberName(member, room.you)}</span>
            {member.id === room.you ? <span className="lyrix-tag">toi</span> : null}
            {member.id === room.host.id ? <span className="lyrix-tag is-host">hôte</span> : null}
          </span>
        </li>
      ))}
      {waiting ? (
        <li className="lyrix-member is-waiting">
          <span className="lyrix-avatar is-empty" aria-hidden="true" />
          <span className="lyrix-member-text">
            <span className="lyrix-member-name">En attente…</span>
          </span>
        </li>
      ) : null}
    </ul>
  );
});

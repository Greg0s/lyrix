import { memo, useEffect, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
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

/** Between a name and its tip, in pixels. */
const NAME_TIP_GAP_PX = 6;

/** Where a name's tip sits on the screen: centred above the name. */
interface NameTipPlace {
  left: number;
  bottom: number;
}

interface MemberNameProps {
  member: RoomMember;
  you: string;
}

/**
 * A player's name, cut short by its ellipsis when the row is too narrow (game.css). Under a mouse, a cut name
 * shows in full in a tip of the player's colour; a name that fits gets none, and a touch screen never does.
 * Measured on hover rather than on render, and the tip's state is this name's own: nothing else re-renders.
 * Into <body>: the card's grid scrolls, which would clip it, and the card keeps its entrance's transform.
 * Hidden from screen readers, who already read the whole name.
 */
function MemberName({ member, you }: MemberNameProps) {
  const [tip, setTip] = useState<NameTipPlace | null>(null);

  // A tip placed on the screen would stay behind while its name scrolls away.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [tip]);

  const show = (event: PointerEvent<HTMLSpanElement>) => {
    const name = event.currentTarget;
    if (event.pointerType !== "mouse" || name.scrollWidth <= name.clientWidth) return;
    const box = name.getBoundingClientRect();
    setTip({
      left: box.left + box.width / 2,
      bottom: document.documentElement.clientHeight - box.top + NAME_TIP_GAP_PX,
    });
  };

  const text = memberName(member, you);
  return (
    <span className="lyrix-member-name" onPointerEnter={show} onPointerLeave={() => setTip(null)}>
      {text}
      {tip
        ? createPortal(
            <span
              className="lyrix-name-tip"
              style={{ ...playerStyle(member, you), left: tip.left, bottom: tip.bottom }}
              aria-hidden="true"
            >
              {text}
            </span>,
            document.body
          )
        : null}
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
            <MemberName member={member} you={room.you} />
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

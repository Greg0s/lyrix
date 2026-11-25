import type { RoomOutcome, RoomView } from "../hooks/useRoom";
import { InRoom, RoomForms } from "./MultiplayerModal";

interface RoomScreenProps {
  /** The room the player is in, if any: the page then shows it instead of the create/join forms. */
  room: RoomView | null;
  /**
   * The code of the invite link the app was opened with, below 880px, where
   * the room is a tab rather than the dialog: the forms show with it typed
   * in, even in another room, which joining it leaves.
   */
  invite?: string | null;
  onCreate: (pseudo: string) => Promise<RoomOutcome>;
  onJoin: (code: string, pseudo: string) => Promise<RoomOutcome>;
  onLeave: () => void;
  /** Goes to the round the room plays: after a join, or from "Chercher ensemble". */
  onPlay: () => void;
}

/**
 * The room's page (/jouer-a-plusieurs): what the multiplayer dialog holds,
 * as a screen of its own, the tab bar's "Salon" below 880px (asked for by the
 * developer: a tab, not a dialog). Out of a room, "Rejoindre" and "Créer un
 * salon"; in one, its code, invite link and members. Creating a room stays
 * here, on the new room, to share it; joining one goes to its round, as the
 * dialog closes on a join. Leaving stays here, on the forms. Opened from an
 * invite link to another room, the forms show, with its code typed in.
 */
export function RoomScreen({ room, invite = null, onCreate, onJoin, onLeave, onPlay }: RoomScreenProps) {
  const inRoom = room !== null && (invite === null || invite === room.code);
  return (
    <main className="lyrix-room-page">
      <section className="lyrix-card lyrix-room-panel" aria-labelledby="lyrix-room-page-title">
        <h1 id="lyrix-room-page-title" className="lyrix-room-page-title">
          Jouer à plusieurs
        </h1>
        {inRoom && room ? (
          <InRoom room={room} onDone={onPlay} onLeave={onLeave} />
        ) : (
          <RoomForms
            invite={invite}
            initialTab="join"
            currentRoom={room?.code ?? null}
            onCreate={onCreate}
            onJoin={onJoin}
            onJoined={onPlay}
          />
        )}
      </section>
    </main>
  );
}

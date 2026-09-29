import { memo } from "react";
import { playerCountLabel } from "../game/room";
import { GroupIcon } from "./GroupIcon";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

interface AppHeaderProps {
  /** How many players are connected to the player's room; null outside a room. */
  roomPlayers: number | null;
  onOpenMultiplayer: () => void;
  onOpenHelp: () => void;
}

/** Sticky top bar. Memoized with stable callbacks, so typing a guess never re-renders it. */
export const AppHeader = memo(function AppHeader({ roomPlayers, onOpenMultiplayer, onOpenHelp }: AppHeaderProps) {
  const inRoom = roomPlayers !== null;
  const roomLabel = inRoom ? `Salon · ${playerCountLabel(roomPlayers)}` : "";
  return (
    <header className="lyrix-topbar">
      <div className="lyrix-topbar-inner">
        <div className="lyrix-brand">
          <Logo />
          <span className="lyrix-slogan">Découvre la chanson&nbsp;!</span>
        </div>
        <div className="lyrix-topbar-actions">
          <button
            type="button"
            className="lyrix-pill is-dark"
            onClick={onOpenMultiplayer}
            aria-label={inRoom ? roomLabel : "Jouer à plusieurs"}
          >
            <span className="lyrix-pill-icon">
              <GroupIcon />
              {inRoom ? <span className="lyrix-presence-dot" aria-hidden="true" /> : null}
            </span>
            {inRoom ? (
              <>
                <span className="lyrix-pill-label is-room">{roomLabel}</span>
                {/* Just the number on the narrowest screens (game.css). */}
                <span className="lyrix-pill-label is-room-count" aria-hidden="true">
                  {roomPlayers}
                </span>
              </>
            ) : (
              <span className="lyrix-pill-label is-multiplayer">Jouer à plusieurs</span>
            )}
          </button>
          <button type="button" className="lyrix-pill is-outline" onClick={onOpenHelp} aria-label="Comment jouer">
            <span className="lyrix-help-dot" aria-hidden="true">
              ?
            </span>
            <span className="lyrix-pill-label is-help">Comment jouer</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
});

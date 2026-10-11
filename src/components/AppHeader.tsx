import { memo, useCallback, useEffect, useState } from "react";
import { playerCountLabel } from "../game/room";
import { prefersReducedMotion } from "../reducedMotion";
import { TODAY, type Route } from "../routes";
import { CalendarIcon } from "./CalendarIcon";
import { GroupIcon } from "./GroupIcon";
import { LOGO_EXIT_MS, Logo } from "./Logo";
import { RouteLink } from "./RouteLink";
import { ThemeToggle } from "./ThemeToggle";

interface AppHeaderProps {
  /** How many players are connected to the player's room; null outside a room. */
  roomPlayers: number | null;
  onOpenMultiplayer: () => void;
  /** The archives screen is the one shown: the button says so (aria-current), and closes it. */
  archivesOpen: boolean;
  onToggleArchives: () => void;
  /** Same for the rules' page. */
  helpOpen: boolean;
  onToggleHelp: () => void;
  /** Changes screen in place: the logo goes to today's song. */
  onNavigate: (to: Route) => void;
}

/** Sticky top bar. Memoized with stable callbacks, so typing a guess never re-renders it. */
export const AppHeader = memo(function AppHeader({
  roomPlayers,
  onOpenMultiplayer,
  archivesOpen,
  onToggleArchives,
  helpOpen,
  onToggleHelp,
  onNavigate,
}: AppHeaderProps) {
  // Each click on the logo goes to today's song at once, while the logo leaves,
  // then plays its entrance again: a new key remounts it. A click while it
  // leaves changes nothing; under reduced motion it neither leaves nor comes in.
  const [logoPlays, setLogoPlays] = useState(0);
  const [logoLeaving, setLogoLeaving] = useState(false);
  const onLogoClick = useCallback(
    (to: Route) => {
      onNavigate(to);
      if (!prefersReducedMotion()) setLogoLeaving(true);
    },
    [onNavigate],
  );
  useEffect(() => {
    if (!logoLeaving) return;
    const timer = window.setTimeout(() => {
      setLogoLeaving(false);
      setLogoPlays((plays) => plays + 1);
    }, LOGO_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [logoLeaving]);
  const inRoom = roomPlayers !== null;
  const roomLabel = inRoom ? `Salon · ${playerCountLabel(roomPlayers)}` : "";
  return (
    <header className="lyrix-topbar">
      <div className="lyrix-topbar-inner">
        <div className="lyrix-brand">
          <RouteLink to={TODAY} onNavigate={onLogoClick} className="lyrix-logo-link" aria-label="Lyrix, chanson du jour">
            <Logo key={logoPlays} leaving={logoLeaving} />
          </RouteLink>
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
          <button
            type="button"
            className={`lyrix-pill is-outline${archivesOpen ? " is-current" : ""}`}
            onClick={onToggleArchives}
            aria-label="Archives"
            aria-current={archivesOpen ? "page" : undefined}
          >
            <CalendarIcon />
            <span className="lyrix-pill-label is-archives">Archives</span>
          </button>
          <button
            type="button"
            className={`lyrix-pill is-outline${helpOpen ? " is-current" : ""}`}
            onClick={onToggleHelp}
            aria-label="Comment jouer"
            aria-current={helpOpen ? "page" : undefined}
          >
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

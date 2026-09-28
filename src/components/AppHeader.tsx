import { memo } from "react";
import { GroupIcon } from "./GroupIcon";
import { Logo } from "./Logo";

interface AppHeaderProps {
  onOpenMultiplayer: () => void;
  onOpenHelp: () => void;
}

/** Sticky top bar. Memoized with stable callbacks, so typing a guess never re-renders it. */
export const AppHeader = memo(function AppHeader({ onOpenMultiplayer, onOpenHelp }: AppHeaderProps) {
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
            aria-label="Jouer à plusieurs"
          >
            <GroupIcon />
            <span className="lyrix-pill-label is-multiplayer">Jouer à plusieurs</span>
          </button>
          <button type="button" className="lyrix-pill is-outline" onClick={onOpenHelp} aria-label="Comment jouer">
            <span className="lyrix-help-dot" aria-hidden="true">
              ?
            </span>
            <span className="lyrix-pill-label is-help">Comment jouer</span>
          </button>
        </div>
      </div>
    </header>
  );
});

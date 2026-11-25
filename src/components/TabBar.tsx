import { memo } from "react";
import { EVENTS, track } from "../analytics";
import { playerCountLabel } from "../game/room";
import { ARCHIVES, HELP, TODAY, type Route } from "../routes";
import { CalendarIcon } from "./CalendarIcon";
import { GroupIcon } from "./GroupIcon";
import { MoreIcon } from "./MoreIcon";
import { NoteIcon } from "./NoteIcon";
import { RouteLink } from "./RouteLink";

interface TabBarProps {
  /** The screen shown: its tab is the current one. */
  route: Route;
  /** How many players are connected to the player's room; null outside a room. */
  roomPlayers: number | null;
  onOpenMultiplayer: () => void;
  onNavigate: (to: Route) => void;
}

/**
 * The bar of tabs along the bottom of a phone's screen, below 880px only
 * (game.css), in place of the header's buttons: the round, the archives, the
 * room, and "Plus": the rules' page, which holds the theme's card there. A tab is a link to its screen; the room's opens its dialog.
 * Hidden while the guess input has the keyboard up. Memoized on stable
 * callbacks, so typing a guess never re-renders it.
 */
export const TabBar = memo(function TabBar({ route, roomPlayers, onOpenMultiplayer, onNavigate }: TabBarProps) {
  const onRound = route.name === "today" || route.name === "day";
  const inRoom = roomPlayers !== null;
  const tab = (current: boolean) => (current ? "lyrix-tab is-current" : "lyrix-tab");
  return (
    <nav className="lyrix-tabbar" aria-label="Navigation">
      {/* On a day of the archives, "Jouer" is that day's round: the screen shown. */}
      <RouteLink
        to={route.name === "day" ? route : TODAY}
        onNavigate={onNavigate}
        className={tab(onRound)}
        aria-current={onRound ? "page" : undefined}
      >
        <span className="lyrix-tab-icon">
          <NoteIcon />
        </span>
        <span className="lyrix-tab-label">Jouer</span>
      </RouteLink>
      <RouteLink
        to={ARCHIVES}
        onNavigate={onNavigate}
        className={tab(route.name === "archives")}
        aria-current={route.name === "archives" ? "page" : undefined}
        data-tour="archives"
        {...track(EVENTS.openArchives, { from: "tabbar" })}
      >
        <span className="lyrix-tab-icon">
          <CalendarIcon />
        </span>
        <span className="lyrix-tab-label">Archives</span>
      </RouteLink>
      <button
        type="button"
        className="lyrix-tab"
        onClick={onOpenMultiplayer}
        aria-label={inRoom ? `Salon, ${playerCountLabel(roomPlayers)}` : "Salon"}
        {...track(EVENTS.openMultiplayer, { from: "tabbar" })}
      >
        <span className="lyrix-tab-icon">
          <GroupIcon />
          {inRoom ? <span className="lyrix-presence-dot" aria-hidden="true" /> : null}
        </span>
        <span className="lyrix-tab-label" aria-hidden="true">
          Salon
        </span>
      </button>
      <RouteLink
        to={HELP}
        onNavigate={onNavigate}
        className={tab(route.name === "help")}
        aria-current={route.name === "help" ? "page" : undefined}
        data-tour="help"
        {...track(EVENTS.openHelp, { from: "tabbar" })}
      >
        <span className="lyrix-tab-icon">
          <MoreIcon />
        </span>
        <span className="lyrix-tab-label">Plus</span>
      </RouteLink>
    </nav>
  );
});

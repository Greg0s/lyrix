import { memo } from "react";
import { EVENTS } from "../analytics";
import { playerCountLabel } from "../game/room";
import { ARCHIVES, HELP, ROOM, TODAY, type Route } from "../routes";
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
  onNavigate: (to: Route) => void;
}

/**
 * The bar of tabs along the bottom of a phone's screen, below 880px only
 * (game.css), in place of the header's buttons: the round, the archives, the
 * room's page, and "Plus": the rules' page, which holds the theme's card
 * there. Every tab is a link to its screen, the room's included: a tab, not
 * the dialog the header's button opens from 880px (asked for by the developer).
 * Hidden while the guess input has the keyboard up. Memoized on stable
 * callbacks, so typing a guess never re-renders it.
 */
export const TabBar = memo(function TabBar({ route, roomPlayers, onNavigate }: TabBarProps) {
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
        tracked={{ event: EVENTS.openArchives, data: { from: "tabbar" } }}
      >
        <span className="lyrix-tab-icon">
          <CalendarIcon />
        </span>
        <span className="lyrix-tab-label">Archives</span>
      </RouteLink>
      <RouteLink
        to={ROOM}
        onNavigate={onNavigate}
        className={tab(route.name === "room")}
        aria-current={route.name === "room" ? "page" : undefined}
        aria-label={inRoom ? `Salon, ${playerCountLabel(roomPlayers)}` : "Salon"}
        tracked={{ event: EVENTS.openMultiplayer, data: { from: "tabbar" } }}
      >
        <span className="lyrix-tab-icon">
          <GroupIcon />
          {inRoom ? <span className="lyrix-presence-dot" aria-hidden="true" /> : null}
        </span>
        <span className="lyrix-tab-label" aria-hidden="true">
          Salon
        </span>
      </RouteLink>
      <RouteLink
        to={HELP}
        onNavigate={onNavigate}
        className={tab(route.name === "help")}
        aria-current={route.name === "help" ? "page" : undefined}
        data-tour="help"
        tracked={{ event: EVENTS.openHelp, data: { from: "tabbar" } }}
      >
        <span className="lyrix-tab-icon">
          <MoreIcon />
        </span>
        <span className="lyrix-tab-label">Plus</span>
      </RouteLink>
    </nav>
  );
});

import { memo } from "react";
import { dayStart, isPlayableDay, utcDay } from "../game/daily";
import { capitalize, longDayLabel, relativeDayLabel } from "../game/frenchDates";
import { ARCHIVES, TODAY, type Route } from "../routes";
import { CalendarIcon } from "./CalendarIcon";
import { ChevronIcon } from "./ChevronIcon";
import { RouteLink } from "./RouteLink";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day before or after `day`, as a screen: today's song for today, nothing the archives don't offer. */
function neighbour(day: string, offset: number): Route | null {
  const other = utcDay(new Date(dayStart(day).getTime() + offset * DAY_MS));
  if (other === utcDay()) return TODAY;
  return isPlayableDay(other) ? { name: "day", day: other } : null;
}

interface DayBarProps {
  day: string;
  onNavigate: (to: Route) => void;
}

/** Above a day of the archives: which day it is, the days either side, the way back to the archives. */
export const DayBar = memo(function DayBar({ day, onNavigate }: DayBarProps) {
  const previous = neighbour(day, -1);
  const next = neighbour(day, 1);
  const step = (to: Route | null, direction: "back" | "forward") => {
    const label = direction === "back" ? "Jour précédent" : "Jour suivant";
    if (!to) {
      return (
        <span className="lyrix-day-step is-disabled" aria-hidden="true">
          <ChevronIcon direction={direction} />
        </span>
      );
    }
    const name = to.name === "day" ? capitalize(longDayLabel(to.day)) : "Chanson du jour";
    return (
      <RouteLink to={to} onNavigate={onNavigate} className="lyrix-day-step" aria-label={`${label} : ${name}`}>
        <ChevronIcon direction={direction} />
      </RouteLink>
    );
  };
  return (
    <nav className="lyrix-day-bar" aria-label="Jours des archives">
      <div className="lyrix-day-bar-days">
        {step(previous, "back")}
        <div className="lyrix-day-bar-label">
          <span className="lyrix-day-bar-date">{capitalize(longDayLabel(day))}</span>
          <span className="lyrix-day-bar-when">Archives · {relativeDayLabel(day)}</span>
        </div>
        {step(next, "forward")}
      </div>
      <RouteLink
        to={ARCHIVES}
        onNavigate={onNavigate}
        className="lyrix-pill is-outline lyrix-day-bar-all"
        aria-label="Toutes les archives"
      >
        <CalendarIcon size={16} />
        <span className="lyrix-day-bar-all-label">Toutes les archives</span>
      </RouteLink>
    </nav>
  );
});

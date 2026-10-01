import { memo, type CSSProperties } from "react";
import { coverTitleSize, triesLabel, type ArchiveDay } from "../game/archive";
import {
  capitalize,
  dayOfMonth,
  longDayLabel,
  monthAbbreviation,
  shortDayLabel,
  weekdayAbbreviation,
} from "../game/frenchDates";
import type { DisplayToken } from "../game/types";
import { TODAY, type Route } from "../routes";
import { RouteLink } from "./RouteLink";

interface ArchiveCoverProps {
  archived: ArchiveDay;
  onNavigate: (to: Route) => void;
}

/** A title as the player left it: found words spelled out, the others bars of their length. Read out as a whole by the cover's label. */
function MaskedTitle({ tokens }: { tokens: readonly DisplayToken[] }) {
  return (
    <p className="lyrix-cover-masked" aria-hidden="true">
      {tokens.map((token, index) =>
        token.isWord && !token.revealed ? (
          <span key={index} className="lyrix-cover-bar">
            {"x".repeat(token.text.length)}
          </span>
        ) : (
          <span key={index}>{token.text}</span>
        )
      )}
    </p>
  );
}

function Progress({ percent }: { percent: number }) {
  return (
    <div className="lyrix-cover-progress" aria-hidden="true">
      <div className="lyrix-cover-track">
        <div className="lyrix-cover-fill" style={{ width: `${percent}%` }} />
      </div>
      <span>{percent}&nbsp;%</span>
    </div>
  );
}

function titleOf(tokens: readonly DisplayToken[]): string {
  return tokens.map((token) => token.text).join("");
}

/**
 * One day of the archives (the "Collection" mockup, 1c): a song found is a
 * dark cover with its title; one started shows its title as left, bars for
 * the words still hidden; a day never played is an empty slot, saying
 * nothing of its song; a day before the game had songs can't be opened.
 */
export const ArchiveCover = memo(function ArchiveCover({ archived, onNavigate }: ArchiveCoverProps) {
  const { day, status, entry, leaving } = archived;
  const date = capitalize(longDayLabel(day));

  if (status === "unavailable") {
    return (
      <div className="lyrix-cover is-unavailable" aria-label={`${date} : pas de chanson ce jour-là`} role="img">
        <div className="lyrix-cover-top" aria-hidden="true">
          <span className="lyrix-cover-kicker">{weekdayAbbreviation(day)}</span>
        </div>
        <div className="lyrix-cover-date" aria-hidden="true">
          <span className="lyrix-cover-day">{dayOfMonth(day)}</span>
          <span className="lyrix-cover-month">{monthAbbreviation(day)}</span>
        </div>
        <span className="lyrix-cover-foot" aria-hidden="true">
          Pas de chanson
        </span>
      </div>
    );
  }

  const to: Route = status === "today" ? TODAY : { name: "day", day };
  const found = entry?.victory === true;

  if (found && entry) {
    const title = titleOf(entry.title);
    const label =
      status === "today"
        ? `Chanson du jour, trouvée : ${title}${entry.artist ? `, ${entry.artist}` : ""}`
        : `${date} : ${title}${entry.artist ? `, ${entry.artist}` : ""}, trouvée en ${triesLabel(entry.tries)}`;
    return (
      <RouteLink to={to} onNavigate={onNavigate} className="lyrix-cover is-solved" aria-label={label}>
        <div className="lyrix-cover-top" aria-hidden="true">
          <span className="lyrix-cover-dash" />
          <span className="lyrix-cover-when">{status === "today" ? "Chanson du jour" : shortDayLabel(day)}</span>
        </div>
        <div aria-hidden="true">
          <p className="lyrix-cover-title" style={{ "--cover-title-size": `${coverTitleSize(title)}px` } as CSSProperties}>
            {title}
          </p>
          {entry.artist ? <p className="lyrix-cover-artist">{entry.artist}</p> : null}
        </div>
      </RouteLink>
    );
  }

  if (status === "today") {
    const percent = entry?.percent ?? 0;
    return (
      <RouteLink
        to={to}
        onNavigate={onNavigate}
        className="lyrix-cover is-today"
        aria-label={entry && entry.tries > 0 ? `Chanson du jour, en cours, ${percent} % des paroles` : "Chanson du jour, à découvrir"}
      >
        <div className="lyrix-cover-top" aria-hidden="true">
          <span className="lyrix-cover-kicker">Chanson du jour</span>
        </div>
        {entry ? <MaskedTitle tokens={entry.title} /> : <p className="lyrix-cover-play" aria-hidden="true">À toi de jouer</p>}
        <Progress percent={percent} />
      </RouteLink>
    );
  }

  if (status === "progress" && entry) {
    return (
      <RouteLink
        to={to}
        onNavigate={onNavigate}
        className="lyrix-cover is-progress"
        aria-label={`${date} : en cours, ${entry.percent} % des paroles`}
      >
        <div className="lyrix-cover-top" aria-hidden="true">
          <span className="lyrix-cover-kicker is-accent">En cours</span>
          <span className="lyrix-cover-when">{shortDayLabel(day)}</span>
        </div>
        <MaskedTitle tokens={entry.title} />
        <Progress percent={entry.percent} />
      </RouteLink>
    );
  }

  return (
    <RouteLink
      to={to}
      onNavigate={onNavigate}
      className="lyrix-cover is-new"
      aria-label={`${date} : à découvrir${leaving ? ", dernier jour avant de quitter les archives" : ""}`}
    >
      <div className="lyrix-cover-top" aria-hidden="true">
        <span className="lyrix-cover-kicker">{weekdayAbbreviation(day)}</span>
        {leaving ? <span className="lyrix-cover-leaving">Dernier jour</span> : null}
      </div>
      <div className="lyrix-cover-date" aria-hidden="true">
        <span className="lyrix-cover-day">{dayOfMonth(day)}</span>
        <span className="lyrix-cover-month">{monthAbbreviation(day)}</span>
      </div>
      <span className="lyrix-cover-foot" aria-hidden="true">
        À découvrir
      </span>
    </RouteLink>
  );
});

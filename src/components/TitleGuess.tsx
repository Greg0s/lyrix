import { memo, type CSSProperties } from "react";
import { useRovingBlanks } from "../hooks/useRovingBlanks";
import { triesLabel } from "../game/archive";
import { longDayLabel } from "../game/frenchDates";
import type { SlotToken } from "../game/slots";
import { Celebration } from "./Celebration";
import { NextSongCountdown } from "./NextSongCountdown";
import { VictoryFoot } from "./VictoryFoot";
import { TokenRun } from "./TokenRun";

interface TitleGuessProps {
  titleTokens: SlotToken[];
  victory: boolean;
  /** Playing in a room: the group found it, not the player alone. */
  group: boolean;
  artist?: string;
  /** See WordToken: highlights every occurrence of the word the latest guess found. */
  lastFoundKey: string | null;
  /** True once the player has checked "show all lyrics" - see GameScreen. */
  revealAllLyrics: boolean;
  onToggleRevealAllLyrics: () => void;
  /**
   * Non-zero once a guess of the player's own has completed the title, and
   * new for each such win (useGame): the win is celebrated. Zero for a round
   * that came back already won, which is only shown.
   */
  celebration: number;
  /** The day of the archives this round is the song of; null for today's song. */
  archiveDay: string | null;
  /** Words tried on the round: a day of the archives, once won, says how many it took. */
  tries: number;
  /** How many past days of the archives are still to find: today's victory points to them. */
  daysLeft: number;
  /** The day the archives suggest next, once a day of them is won. */
  nextDay: string | null;
  onOpenArchives: () => void;
  onPlayDay: (day: string) => void;
}

/**
 * The masked title, then the victory panel once it is found. Where the v3
 * mockup offers "Rejouer avec une autre chanson", the panel keeps the daily
 * model instead: one song a day for everyone, so it counts down to tomorrow's
 * and offers the "show all lyrics" checkbox (see CLAUDE.md's domain rules).
 * Below, the archives: today's victory points to the days still to find, a
 * day of the archives won says when it was and offers the next one.
 *
 * The moment a guess completes the title (#42), the title's words pop one
 * after another before the panel comes in (game.css, `is-celebrating`), and
 * confetti bursts from the title (Celebration). A reload of the won round
 * does none of it.
 */
export const TitleGuess = memo(function TitleGuess({
  titleTokens,
  victory,
  group,
  artist,
  lastFoundKey,
  revealAllLyrics,
  onToggleRevealAllLyrics,
  celebration,
  archiveDay,
  tries,
  daysLeft,
  nextDay,
  onOpenArchives,
  onPlayDay,
}: TitleGuessProps) {
  // One tab stop into the title's bars, like the lyrics' (see useRovingBlanks).
  const roving = useRovingBlanks<HTMLHeadingElement>();
  // How many words pop before the panel comes in.
  const style = celebration
    ? ({ "--words": titleTokens.filter((token) => token.isWord).length } as CSSProperties)
    : undefined;
  return (
    <div className={`lyrix-title-block${celebration ? " is-celebrating" : ""}`} style={style}>
      <p className="lyrix-eyebrow">Titre de chanson à deviner</p>
      <h1 className="lyrix-title-line" ref={roving.ref} onFocus={roving.onFocus} onKeyDown={roving.onKeyDown}>
        <TokenRun tokens={titleTokens} lastFoundKey={lastFoundKey} rankWords={celebration > 0} />
      </h1>

      {victory ? (
        <div className="lyrix-victory">
          <div className="lyrix-victory-text">
            <p className="lyrix-victory-eyebrow">
              {group ? "Bravo, le groupe l'a trouvée\u00a0!" : "Bravo, tu l'as trouvée\u00a0!"}
            </p>
            <p className="lyrix-victory-song">
              {titleTokens.map((token) => token.text).join("")}
              {artist ? ` · ${artist}` : null}
            </p>
            {archiveDay === null ? (
              <>
                <p className="lyrix-victory-note">Reviens demain pour une nouvelle chanson&nbsp;!</p>
                <NextSongCountdown />
              </>
            ) : (
              <p className="lyrix-victory-note">
                Chanson du {longDayLabel(archiveDay)}, trouvée en {triesLabel(tries)}.
              </p>
            )}
          </div>
          <label className="lyrix-reveal-all">
            <input type="checkbox" checked={revealAllLyrics} onChange={onToggleRevealAllLyrics} />
            Afficher tous les lyrics
          </label>
          <VictoryFoot
            archiveDay={archiveDay}
            daysLeft={daysLeft}
            nextDay={nextDay}
            onOpenArchives={onOpenArchives}
            onPlayDay={onPlayDay}
          />
        </div>
      ) : null}

      {/* Keyed by the win, so a new one bursts anew; the title line is what it bursts from. */}
      {celebration ? <Celebration key={celebration} from={roving.ref} /> : null}
    </div>
  );
});

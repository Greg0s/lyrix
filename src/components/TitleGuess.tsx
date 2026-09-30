import { memo, type CSSProperties } from "react";
import { useRovingBlanks } from "../hooks/useRovingBlanks";
import type { SlotToken } from "../game/slots";
import { Celebration } from "./Celebration";
import { NextSongCountdown } from "./NextSongCountdown";
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
}

/**
 * The masked title, then the victory panel once it is found. Where the v3
 * mockup offers "Rejouer avec une autre chanson", the panel keeps the daily
 * model instead: one song a day for everyone, so it counts down to tomorrow's
 * and offers the "show all lyrics" checkbox (see CLAUDE.md's domain rules).
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
            <p className="lyrix-victory-note">Reviens demain pour une nouvelle chanson&nbsp;!</p>
            <NextSongCountdown />
          </div>
          <label className="lyrix-reveal-all">
            <input type="checkbox" checked={revealAllLyrics} onChange={onToggleRevealAllLyrics} />
            Afficher tous les lyrics
          </label>
        </div>
      ) : null}

      {/* Keyed by the win, so a new one bursts anew; the title line is what it bursts from. */}
      {celebration ? <Celebration key={celebration} from={roving.ref} /> : null}
    </div>
  );
});

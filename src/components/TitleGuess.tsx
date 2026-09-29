import { memo } from "react";
import { useRovingBlanks } from "../hooks/useRovingBlanks";
import type { SlotToken } from "../game/slots";
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
}

/**
 * The masked title, then the victory panel once it is found. Where the v3
 * mockup offers "Rejouer avec une autre chanson", the panel keeps the daily
 * model instead: one song a day for everyone, so it counts down to tomorrow's
 * and offers the "show all lyrics" checkbox (see CLAUDE.md's domain rules).
 */
export const TitleGuess = memo(function TitleGuess({
  titleTokens,
  victory,
  group,
  artist,
  lastFoundKey,
  revealAllLyrics,
  onToggleRevealAllLyrics,
}: TitleGuessProps) {
  // One tab stop into the title's bars, like the lyrics' (see useRovingBlanks).
  const roving = useRovingBlanks<HTMLHeadingElement>();
  return (
    <div className="lyrix-title-block">
      <p className="lyrix-eyebrow">Titre de chanson à deviner</p>
      <h1 className="lyrix-title-line" ref={roving.ref} onFocus={roving.onFocus} onKeyDown={roving.onKeyDown}>
        <TokenRun tokens={titleTokens} lastFoundKey={lastFoundKey} />
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
    </div>
  );
});

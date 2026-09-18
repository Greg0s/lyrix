import { memo } from "react";
import type { SlotToken } from "../game/slots";
import { WordToken } from "./WordToken";

interface TitleGuessProps {
  titleTokens: SlotToken[];
  victory: boolean;
  artist?: string;
  /** True once the player has checked "show all lyrics" - see GameScreen. */
  revealAllLyrics: boolean;
  onToggleRevealAllLyrics: () => void;
}

export const TitleGuess = memo(function TitleGuess({
  titleTokens,
  victory,
  artist,
  revealAllLyrics,
  onToggleRevealAllLyrics,
}: TitleGuessProps) {
  return (
    <div>
      <p className="lyrix-title-label">Titre à deviner</p>
      <p className="lyrix-title-line">
        {titleTokens.map((token, index) => (
          <WordToken key={index} token={token} />
        ))}
      </p>

      {victory ? (
        <div className="lyrix-victory">
          <p className="lyrix-victory-eyebrow">Bravo, tu l'as trouvée&nbsp;!</p>
          <p className="lyrix-victory-title">{titleTokens.map((token) => token.text).join("")}</p>
          <p className="lyrix-victory-artist">{artist}</p>
          <label className="lyrix-reveal-all">
            <input type="checkbox" checked={revealAllLyrics} onChange={onToggleRevealAllLyrics} />
            Afficher tous les lyrics
          </label>
          <p className="lyrix-victory-note">Reviens demain pour une nouvelle chanson&nbsp;!</p>
        </div>
      ) : null}
    </div>
  );
});

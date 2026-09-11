import type { DisplayToken } from "../game/types";

interface TitleGuessProps {
  titleTokens: DisplayToken[];
  victory: boolean;
  artist?: string;
}

export function TitleGuess({ titleTokens, victory, artist }: TitleGuessProps) {
  return (
    <div>
      <p className="lyrix-title-label">Titre à deviner</p>
      <p className="lyrix-title-line">
        {titleTokens.map((token, index) => (
          <span
            key={index}
            className={token.isWord ? (token.revealed ? "token-word-found" : "token-word-hidden") : undefined}
          >
            {token.text}
          </span>
        ))}
      </p>

      {victory ? (
        <div className="lyrix-victory">
          <p className="lyrix-victory-eyebrow">Bravo, tu l'as trouvée&nbsp;!</p>
          <p className="lyrix-victory-title">{titleTokens.map((token) => token.text).join("")}</p>
          <p className="lyrix-victory-artist">{artist}</p>
          <p className="lyrix-victory-note">Reviens demain pour une nouvelle chanson&nbsp;!</p>
        </div>
      ) : null}
    </div>
  );
}

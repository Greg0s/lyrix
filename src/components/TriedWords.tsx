import { memo, useMemo } from "react";
import { proximityTier, sortByProximity } from "../game/similarity";
import type { TriedWord } from "../hooks/useGame";
import { heatStyle } from "./heatStyle";

interface TriedWordsProps {
  triedWords: TriedWord[];
}

export const TriedWords = memo(function TriedWords({ triedWords }: TriedWordsProps) {
  // Sorted for display only: the stored list stays in guess order, so a reload
  // doesn't rewrite the player's history. Memoized with the list it sorts, so
  // typing the next guess doesn't re-sort and re-render every chip.
  const sorted = useMemo(() => sortByProximity(triedWords), [triedWords]);
  const anyScored = useMemo(() => triedWords.some((word) => word.score !== null), [triedWords]);

  return (
    <div>
      {anyScored ? (
        <p className="lyrix-legend">
          Plus le score est élevé, plus le mot est proche d'un mot caché&nbsp;: à 40, il fait partie de ses 1&nbsp;000
          plus proches voisins, à 60 des 100, à 80 des 10.
        </p>
      ) : null}
      <div className="lyrix-tried-list">
        {sorted.map((word) => {
          const tier = proximityTier(word);
          const score = word.found ? null : word.score;
          return (
            <span
              key={word.key}
              className={`lyrix-chip ${word.found ? "is-found" : "is-missed"} tier-${tier}`}
              style={score !== null ? heatStyle(score) : undefined}
              title={word.found ? "Dans les paroles" : score !== null ? `Proximité : ${score}/100` : undefined}
            >
              {word.display}
              {score !== null ? <span className="lyrix-chip-score">{score}</span> : null}
            </span>
          );
        })}
        {sorted.length === 0 ? <p className="lyrix-empty">Rien pour l'instant…</p> : null}
      </div>
      {/* CC BY 3.0 asks for credit wherever the model's numbers are shown, which is exactly when a score is. */}
      {anyScored ? (
        <p className="lyrix-credit">
          Proximités calculées avec le modèle{" "}
          <a href="https://fauconnier.github.io/#data" target="_blank" rel="noreferrer">
            frWac2Vec
          </a>{" "}
          de Jean-Philippe Fauconnier (licence CC BY 3.0).
        </p>
      ) : null}
    </div>
  );
});

import { proximityTier, sortByProximity } from "../game/similarity";
import type { TriedWord } from "../hooks/useGame";

interface TriedWordsProps {
  triedWords: TriedWord[];
}

export function TriedWords({ triedWords }: TriedWordsProps) {
  // Sorted at render time only: the stored list stays in guess order, so a
  // reload doesn't rewrite the player's history.
  const sorted = sortByProximity(triedWords);
  const anyScored = triedWords.some((word) => word.score !== null);

  return (
    <div>
      {anyScored ? (
        <p className="lyrix-legend">Plus le score est élevé, plus le mot est proche du sens des paroles.</p>
      ) : null}
      <div className="lyrix-tried-list">
        {sorted.map((word) => {
          const tier = proximityTier(word);
          return (
            <span
              key={word.key}
              className={`lyrix-chip ${word.found ? "is-found" : "is-missed"} tier-${tier}`}
              title={word.found ? "Dans les paroles" : word.score !== null ? `Proximité : ${word.score}/100` : undefined}
            >
              {word.display}
              {!word.found && word.score !== null ? <span className="lyrix-chip-score">{word.score}</span> : null}
            </span>
          );
        })}
        {sorted.length === 0 ? <p className="lyrix-empty">Rien pour l'instant…</p> : null}
      </div>
    </div>
  );
}

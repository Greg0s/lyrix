import { memo, useMemo } from "react";
import { proximityTier, sortByProximity } from "../game/similarity";
import type { TriedWord } from "../hooks/useGame";
import { heatStyle } from "./heatStyle";
import { playerStyle } from "./playerColor";

interface TriedWordsProps {
  triedWords: TriedWord[];
  /** In a room: whose words these are, so each chip carries its player's colour. Null in solo play. */
  group: { you: string } | null;
  /** In a sheet (below 880px, from the dock's button): the list alone, under the sheet's own title. */
  inSheet?: boolean;
}

/**
 * The "Tes mots" card, "Mots du groupe" in a room (every member's guesses,
 * each chip dotted with its player's colour): in the side column from 880px,
 * and below, where the side column is out of the page, as a sheet the dock's
 * button opens (DockShortcuts, `inSheet`).
 */
export const TriedWords = memo(function TriedWords({ triedWords, group, inSheet = false }: TriedWordsProps) {
  const title = group ? "Mots du groupe" : "Tes mots";
  // Sorted for display only: the stored list stays in guess order, so a reload
  // doesn't rewrite the player's history. Memoized with the list it sorts, so
  // typing the next guess doesn't re-sort and re-render every chip.
  const sorted = useMemo(() => sortByProximity(triedWords), [triedWords]);
  const anyScored = useMemo(() => triedWords.some((word) => word.score !== null), [triedWords]);
  // The latest guess pops in wherever its score sorts it. Two identical
  // animations, alternated, so it replays on every guess (see global.css).
  const freshKey = triedWords[0]?.key;
  const freshClass = triedWords.length % 2 ? " is-fresh-a" : " is-fresh-b";

  const body = (
    <div className="lyrix-words-body">
      {anyScored ? (
        <p className="lyrix-legend">
          Plus le score est élevé, plus le mot est proche d'un mot caché, du rouge (loin) au vert (tout
          proche)&nbsp;: à 40, il fait partie de ses 1&nbsp;000 plus proches voisins, à 60 des 100, à 80 des 10.
        </p>
      ) : null}
      <div className="lyrix-tried-list">
        {sorted.map((word) => {
          const tier = proximityTier(word);
          const score = word.found ? null : word.score;
          return (
            <span
              key={word.key}
              className={`lyrix-chip ${word.found ? "is-found" : "is-missed"} tier-${tier}${word.key === freshKey ? freshClass : ""}`}
              style={score !== null ? heatStyle(score) : undefined}
              title={word.found ? "Dans les paroles" : score !== null ? `Proximité : ${score}/100` : undefined}
            >
              {group && word.by ? (
                <span className="lyrix-player-dot" style={playerStyle(word.by, group.you)} aria-hidden="true" />
              ) : null}
              {word.display}
              {score !== null ? <span className="lyrix-chip-score">{score}</span> : null}
            </span>
          );
        })}
        {sorted.length === 0 ? (
          <p className="lyrix-empty">
            {group ? "Les mots proposés par le groupe s'afficheront ici." : "Les mots que tu proposes s'afficheront ici."}
          </p>
        ) : null}
      </div>
    </div>
  );
  if (inSheet) return <div className="lyrix-words is-in-sheet">{body}</div>;

  return (
    <section className="lyrix-card lyrix-words" aria-label={title} data-tour="words">
      <h2 className="lyrix-card-title">{title}</h2>
      {body}
    </section>
  );
});

import { memo, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { proximityTier, sortByProximity } from "../game/similarity";
import type { TriedWord } from "../hooks/useGame";
import { heatStyle } from "./heatStyle";
import { playerStyle } from "./playerColor";

interface TriedWordsProps {
  triedWords: TriedWord[];
  /** In a room: whose words these are, so each chip carries its player's colour. Null in solo play. */
  group: { you: string } | null;
}

/**
 * The "Tes mots" card, "Mots du groupe" in a room (every member's guesses,
 * each chip dotted with its player's colour). On mobile it sits above the lyrics, so it starts
 * collapsed to its header (title + word count) and opens on a tap; from 880px
 * up it is always open and the toggle is inert (game.css). Open/closed is
 * local state: toggling it never re-renders the lyrics.
 *
 * Toggling keeps the header where the player tapped it, so the card opens
 * downward. Left alone, the browser's scroll anchoring holds the lyrics below
 * still instead whenever the page is scrolled, and the card grows upward,
 * pushing its own header off screen.
 */
export const TriedWords = memo(function TriedWords({ triedWords, group }: TriedWordsProps) {
  const title = group ? "Mots du groupe" : "Tes mots";
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  // The toggle's distance from the top of the viewport when it was tapped; null otherwise.
  const tappedTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    const top = tappedTop.current;
    tappedTop.current = null;
    const toggle = toggleRef.current;
    if (top === null || !toggle) return;
    const shift = toggle.getBoundingClientRect().top - top;
    if (shift !== 0) window.scrollBy(0, shift);
  }, [open]);
  // Sorted for display only: the stored list stays in guess order, so a reload
  // doesn't rewrite the player's history. Memoized with the list it sorts, so
  // typing the next guess doesn't re-sort and re-render every chip.
  const sorted = useMemo(() => sortByProximity(triedWords), [triedWords]);
  const anyScored = useMemo(() => triedWords.some((word) => word.score !== null), [triedWords]);
  // The latest guess pops in wherever its score sorts it. Two identical
  // animations, alternated, so it replays on every guess (see global.css).
  const freshKey = triedWords[0]?.key;
  const freshClass = triedWords.length % 2 ? " is-fresh-a" : " is-fresh-b";

  return (
    <section className={`lyrix-card lyrix-words${open ? " is-open" : ""}`} aria-label={title}>
      {/* Disclosure pattern: the button lives inside the heading, never the other way round. */}
      <h2 className="lyrix-words-heading">
        <button
          type="button"
          className="lyrix-words-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          ref={toggleRef}
          onClick={(event) => {
            tappedTop.current = event.currentTarget.getBoundingClientRect().top;
            setOpen((value) => !value);
          }}
        >
          <span className="lyrix-card-title">{title}</span>
          <span className="lyrix-words-count">
            {triedWords.length} mot{triedWords.length < 2 ? "" : "s"}
          </span>
          <span className="lyrix-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      </h2>
      <div className="lyrix-words-body" id={bodyId}>
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
    </section>
  );
});

import { useCallback, useMemo, useState } from "react";
import { closestGuessBySlot, placeNearGuesses } from "../game/slots";
import { useGame } from "../hooks/useGame";
import { useIsMobile } from "../hooks/useIsMobile";
import { GuessForm } from "./GuessForm";
import { HowToPlay } from "./HowToPlay";
import { LyricsBody } from "./LyricsBody";
import { SideCard } from "./SideCard";
import { TitleGuess } from "./TitleGuess";
import { TriedWords } from "./TriedWords";

function feedbackMessage(word: string, found: boolean, nearCount: number): string {
  if (found) return `« ${word} » trouvé !`;
  if (nearCount === 0) return `« ${word} » n’y est pas.`;
  // A close word can land far down the lyrics, out of sight: say so, or the hint goes unnoticed.
  const where = nearCount === 1 ? "d’un mot caché" : `de ${nearCount} mots cachés`;
  return `« ${word} » n’y est pas, mais il est proche ${where}.`;
}

export function GameScreen() {
  const game = useGame();
  const isMobile = useIsMobile();
  const [triedOpen, setTriedOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [revealAllLyrics, setRevealAllLyrics] = useState(false);
  const toggleTried = useCallback(() => setTriedOpen((open) => !open), []);
  const toggleExplain = useCallback(() => setExplainOpen((open) => !open), []);
  const toggleRevealAllLyrics = useCallback(() => setRevealAllLyrics((reveal) => !reveal), []);
  const { submit } = game;
  const onSubmit = useCallback(() => void submit(), [submit]);

  // Derived above the early returns below, so the hooks run on every render.
  // Both walk the whole round, and both are memoized on what they read rather
  // than recomputed per render: that is what keeps a keystroke from
  // re-rendering the lyrics, which have nothing to do with the word being typed.
  const { round, triedWords } = game;
  // Every hidden word shows the closest miss so far; a revealed word always shows itself.
  const slots = useMemo(
    () => (round ? placeNearGuesses(round, closestGuessBySlot(triedWords)) : null),
    [round, triedWords]
  );
  const statsText = useMemo(() => {
    const foundCount = triedWords.filter((word) => word.found).length;
    const triedCount = triedWords.length;
    return triedCount === 0
      ? "À toi de jouer"
      : `${foundCount} trouvé${foundCount === 1 ? "" : "s"} sur ${triedCount} essayé${triedCount === 1 ? "" : "s"}`;
  }, [triedWords]);

  if (game.error && !round) {
    return (
      <div className="lyrix-page">
        <p role="alert">Impossible de charger la partie.</p>
        <button type="button" className="lyrix-button" onClick={() => void game.loadRound()}>
          Réessayer
        </button>
      </div>
    );
  }

  if (!round || !slots) {
    return (
      <div className="lyrix-page">
        <p>Chargement de la partie…</p>
      </div>
    );
  }

  const feedbackText = game.feedback
    ? feedbackMessage(game.feedback.word, game.feedback.found, game.feedback.nearCount)
    : null;

  return (
    <div className="lyrix-page">
      <header className="lyrix-header">
        <h1>Lyrix</h1>
        <p>Trouve la chanson&nbsp;!</p>
      </header>

      <div className={`lyrix-grid${isMobile ? " is-mobile" : ""}`}>
        <div className="lyrix-center-col">
          <TitleGuess
            titleTokens={slots.title}
            victory={round.victory}
            artist={round.artist}
            revealAllLyrics={revealAllLyrics}
            onToggleRevealAllLyrics={toggleRevealAllLyrics}
          />

          <GuessForm
            value={game.inputValue}
            onChange={game.setInputValue}
            onSubmit={onSubmit}
            disabled={game.submitting}
          />

          {game.error ? (
            <p className="lyrix-feedback is-missed" role="alert">
              Le mot n'a pas pu être envoyé, réessaie.
            </p>
          ) : feedbackText ? (
            <p className={`lyrix-feedback ${game.feedback?.found ? "is-found" : "is-missed"}`}>{feedbackText}</p>
          ) : null}

          <LyricsBody sections={slots.sections} revealAll={revealAllLyrics} />
        </div>

        <SideCard
          title="Tes mots"
          tiltClass="tilt-left"
          isMobile={isMobile}
          open={triedOpen}
          onToggle={toggleTried}
          subtitle={<p className="lyrix-stats">{statsText}</p>}
        >
          <TriedWords triedWords={triedWords} />
        </SideCard>

        <SideCard
          title="Comment on joue ?"
          tiltClass="tilt-right"
          isMobile={isMobile}
          open={explainOpen}
          onToggle={toggleExplain}
        >
          <HowToPlay />
        </SideCard>
      </div>
    </div>
  );
}

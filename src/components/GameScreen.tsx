import { useState } from "react";
import { useGame } from "../hooks/useGame";
import { useIsMobile } from "../hooks/useIsMobile";
import { GuessForm } from "./GuessForm";
import { HowToPlay } from "./HowToPlay";
import { LyricsBody } from "./LyricsBody";
import { SideCard } from "./SideCard";
import { TitleGuess } from "./TitleGuess";
import { TriedWords } from "./TriedWords";

export function GameScreen() {
  const game = useGame();
  const isMobile = useIsMobile();
  const [triedOpen, setTriedOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);

  if (game.error && !game.round) {
    return (
      <div className="lyrix-page">
        <p role="alert">{game.error}</p>
      </div>
    );
  }

  if (!game.round) {
    return (
      <div className="lyrix-page">
        <p>Chargement de la partie…</p>
      </div>
    );
  }

  const { round } = game;
  const foundCount = game.triedWords.filter((word) => word.found).length;
  const triedCount = game.triedWords.length;
  const statsText = triedCount === 0 ? "À toi de jouer" : `${foundCount} trouvés sur ${triedCount} essayés`;
  const feedbackText = game.feedback
    ? game.feedback.found
      ? `« ${game.feedback.word} » trouvé !`
      : `« ${game.feedback.word} » n’y est pas.`
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
            titleTokens={round.title.tokens}
            victory={round.victory}
            artist={round.artist}
            onReplay={game.replay}
          />

          <GuessForm
            value={game.inputValue}
            onChange={game.setInputValue}
            onSubmit={() => void game.submit()}
            disabled={game.submitting}
          />

          {feedbackText ? (
            <p className={`lyrix-feedback ${game.feedback?.found ? "is-found" : "is-missed"}`}>{feedbackText}</p>
          ) : null}

          <LyricsBody sections={round.sections} />
        </div>

        <SideCard
          title="Tes mots"
          tiltClass="tilt-left"
          isMobile={isMobile}
          open={triedOpen}
          onToggle={() => setTriedOpen((open) => !open)}
          subtitle={<p className="lyrix-stats">{statsText}</p>}
        >
          <TriedWords triedWords={game.triedWords} />
        </SideCard>

        <SideCard
          title="Comment on joue ?"
          tiltClass="tilt-right"
          isMobile={isMobile}
          open={explainOpen}
          onToggle={() => setExplainOpen((open) => !open)}
        >
          <HowToPlay />
        </SideCard>
      </div>
    </div>
  );
}

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { revealedPercent } from "../game/progress";
import { closestGuessBySlot, placeNearGuesses } from "../game/slots";
import { useGame, type Feedback } from "../hooks/useGame";
import { AppHeader } from "./AppHeader";
import { GuessForm, type GuessFeedback } from "./GuessForm";
import { HowToPlay } from "./HowToPlay";
import { LyricsBody } from "./LyricsBody";
import { MultiplayerModal } from "./MultiplayerModal";
import { MultiplayerPromo } from "./MultiplayerPromo";
import { ProgressCard } from "./ProgressCard";
import { TitleGuess } from "./TitleGuess";
import { TriedWords } from "./TriedWords";

function feedbackMessage({ word, found, duplicate, nearCount }: Feedback): string {
  if (duplicate) return `« ${word} » a déjà été proposé.`;
  if (found) return `« ${word} » trouvé !`;
  if (nearCount === 0) return `« ${word} » n’y est pas.`;
  // A close word can land far down the lyrics, out of sight: say so, or the hint goes unnoticed.
  const where = nearCount === 1 ? "d’un mot caché" : `de ${nearCount} mots cachés`;
  return `« ${word} » n’y est pas, mais il est proche ${where}.`;
}

type Dialog = "help" | "multiplayer" | null;

export function GameScreen() {
  const game = useGame();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [revealAllLyrics, setRevealAllLyrics] = useState(false);
  const openHelp = useCallback(() => setDialog("help"), []);
  const openMultiplayer = useCallback(() => setDialog("multiplayer"), []);
  // Once a dialog is gone, the player is back to guessing: give them the input.
  const closeDialog = useCallback(() => {
    setDialog(null);
    inputRef.current?.focus();
  }, []);
  const toggleRevealAllLyrics = useCallback(() => setRevealAllLyrics((reveal) => !reveal), []);
  const { submit } = game;
  const onSubmit = useCallback(() => void submit(), [submit]);

  // Derived above the early returns below, so the hooks run on every render.
  // Each walks the whole round or the whole guess list, and each is memoized
  // on what it reads rather than recomputed per render: that is what keeps a
  // keystroke from re-rendering the lyrics, which have nothing to do with the
  // word being typed.
  const { round, triedWords } = game;
  // Every hidden word shows the closest miss so far; a revealed word always shows itself.
  const slots = useMemo(
    () => (round ? placeNearGuesses(round, closestGuessBySlot(triedWords)) : null),
    [round, triedWords]
  );
  const percent = useMemo(() => (round ? revealedPercent(round) : 0), [round]);
  const foundCount = useMemo(() => triedWords.filter((word) => word.found).length, [triedWords]);

  const header = <AppHeader onOpenMultiplayer={openMultiplayer} onOpenHelp={openHelp} />;
  const dialogs = (
    <>
      {dialog === "help" ? <HowToPlay onClosed={closeDialog} /> : null}
      {dialog === "multiplayer" ? <MultiplayerModal onClosed={closeDialog} /> : null}
    </>
  );
  const shell = (content: ReactNode) => (
    <div className="lyrix-app">
      {header}
      {content}
      {dialogs}
    </div>
  );

  if (game.error && !round) {
    return shell(
      <main className="lyrix-main is-message">
        <div className="lyrix-card lyrix-message">
          <p role="alert">Impossible de charger la partie.</p>
          <button type="button" className="lyrix-button" onClick={() => void game.loadRound()}>
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  if (!round || !slots) {
    return shell(
      <main className="lyrix-main is-message">
        <div className="lyrix-card lyrix-message">
          <p>Chargement de la partie…</p>
        </div>
      </main>
    );
  }

  const { feedback } = game;
  const lastFoundKey = feedback?.found ? feedback.key : null;
  let guessFeedback: GuessFeedback | null = null;
  if (game.error) {
    guessFeedback = {
      text: "Le mot n'a pas pu être envoyé, réessaie.",
      tone: "error",
      seq: feedback?.seq ?? 0,
      shake: false,
    };
  } else if (feedback) {
    guessFeedback = {
      text: feedbackMessage(feedback),
      tone: feedback.found ? "found" : "missed",
      seq: feedback.seq,
      shake: !feedback.found,
    };
  }

  return shell(
    <main className="lyrix-main">
      <div className="lyrix-game-col">
        <article className="lyrix-card lyrix-song">
          <TitleGuess
            titleTokens={slots.title}
            victory={round.victory}
            artist={round.artist}
            lastFoundKey={lastFoundKey}
            revealAllLyrics={revealAllLyrics}
            onToggleRevealAllLyrics={toggleRevealAllLyrics}
          />
          <LyricsBody sections={slots.sections} revealAll={revealAllLyrics} lastFoundKey={lastFoundKey} />
        </article>

        <GuessForm
          value={game.inputValue}
          onChange={game.setInputValue}
          onSubmit={onSubmit}
          submitting={game.submitting}
          feedback={guessFeedback}
          inputRef={inputRef}
        />
      </div>

      <aside className="lyrix-aside">
        <ProgressCard percent={percent} foundCount={foundCount} triedCount={triedWords.length} />
        <TriedWords triedWords={triedWords} />
        <MultiplayerPromo onOpen={openMultiplayer} />
      </aside>
    </main>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { normalize } from "../game/normalize";
import { proximityTier } from "../game/similarity";
import type { SlotToken } from "../game/slots";
import { heatStyle } from "./heatStyle";

interface WordTokenProps {
  token: SlotToken;
  /** True once the player has checked "show all lyrics" on a won round - see TitleGuess and GameScreen. */
  revealAll?: boolean;
  /** Normalized key of the word the latest guess found, if it found one: every occurrence of it is highlighted. */
  lastFoundKey?: string | null;
}

/** How long a tapped blank shows its letter count, then how long that tip takes to fade out. */
export const PEEK_SHOW_MS = 1500;
export const PEEK_FADE_MS = 200;

interface BlankProps {
  letters: number;
  className: string;
  style?: CSSProperties;
  title?: string;
  /** Read by screen readers after "mot caché, N lettres" - e.g. the close guess sitting on the bar. */
  extraLabel?: string;
  children: ReactNode;
}

/** What a screen reader says for a bar, in place of its masked text. */
export function blankLabel(letters: number, extra?: string): string {
  const base = `mot caché, ${letters} lettre${letters === 1 ? "" : "s"}`;
  return extra ? `${base}, ${extra}` : base;
}

/**
 * A still-hidden word, drawn as a bar. Tapping it - or reaching it from the
 * keyboard (see useRovingBlanks) - shows how many letters it has for a moment:
 * the same thing its width already says, so nothing that isn't on screen yet.
 * Screen readers get that count as text instead of the masked underscores.
 * The tip's state is local, so it re-renders this one word and not the
 * lyrics around it. Its tab stop is managed in the DOM by useRovingBlanks.
 */
function Blank({ letters, className, style, title, extraLabel, children }: BlankProps) {
  const [peek, setPeek] = useState<"in" | "out" | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const show = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setPeek("in");
    timers.current = [
      window.setTimeout(() => setPeek("out"), PEEK_SHOW_MS),
      window.setTimeout(() => setPeek(null), PEEK_SHOW_MS + PEEK_FADE_MS),
    ];
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    show();
  };

  return (
    <span
      className={`token-blank ${className}`}
      style={style}
      title={title}
      onClick={show}
      onFocus={show}
      onKeyDown={onKeyDown}
    >
      <span className="token-blank-face" aria-hidden="true">
        {children}
      </span>
      <span className="sr-only">{blankLabel(letters, extraLabel)}</span>
      {/* Hidden from screen readers: the label above already says it. */}
      {peek ? (
        <span className={`token-peek${peek === "out" ? " is-out" : ""}`} aria-hidden="true">
          {letters} lettre{letters === 1 ? "" : "s"}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A guess longer than the word it sits on shrinks to fit the bar, down to 60 %
 * of the text size, rather than widening the slot and giving its length away.
 */
function fitGuess(guess: string, letters: number): CSSProperties | undefined {
  if (guess.length <= letters) return undefined;
  return { fontSize: `${Math.max(0.6, letters / guess.length).toFixed(2)}em` };
}

/**
 * One token of the title or the lyrics: punctuation as is, or a word that is
 * revealed, holding the closest guess so far, shown by the post-victory
 * "reveal all" checkbox, holding the dev-only low-opacity hint (see CLAUDE.md's
 * anti-cheat section), or plain masked.
 *
 * Order matters: a found word is normal gameplay progress and always takes
 * over from every other rendering. A checked "reveal all" is the player asking
 * to read the actual song, so it takes over from a close-guess placement and
 * the dev hint, never the other way round.
 */
export function WordToken({ token, revealAll = false, lastFoundKey = null }: WordTokenProps) {
  if (!token.isWord) return <span>{token.text}</span>;
  if (token.revealed) {
    const isLast = lastFoundKey !== null && normalize(token.text) === lastFoundKey;
    return <span className={`token-word-found${isLast ? " is-last" : ""}`}>{token.text}</span>;
  }

  if (revealAll && token.revealHint) {
    return (
      <span className="token-word-revealed" title="Affiché via « Afficher tous les lyrics »">
        {token.revealHint}
      </span>
    );
  }

  const letters = token.text.length;

  if (token.near) {
    const { text, score } = token.near;
    return (
      <Blank
        letters={letters}
        className={`token-word-near tier-${proximityTier({ found: false, score })}`}
        style={heatStyle(score)}
        title={`« ${text} » est proche de ce mot (${score}/100)`}
        extraLabel={`« ${text} » est proche, ${score} sur 100`}
      >
        {/* The word's own blank sizes the bar; the guess is laid over it, never wider. */}
        <span className="token-near-blank">
          {token.text}
        </span>
        <span className="token-near-guess" style={fitGuess(text, letters)}>
          {text}
        </span>
      </Blank>
    );
  }

  if (token.devHint) {
    return (
      <Blank
        letters={letters}
        className="token-word-devhint"
        title="Indice de dev (DEV_REVEAL_LYRICS) : mot pas encore trouvé"
      >
        {token.devHint}
      </Blank>
    );
  }

  return (
    <Blank letters={letters} className="token-word-hidden">
      {token.text}
    </Blank>
  );
}

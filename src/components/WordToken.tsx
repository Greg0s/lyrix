import { proximityTier } from "../game/similarity";
import type { SlotToken } from "../game/slots";
import { heatStyle } from "./heatStyle";

interface WordTokenProps {
  token: SlotToken;
}

/**
 * One token of the title or the lyrics: punctuation as is, or a word that is
 * revealed, holding the closest guess so far, holding the dev-only low-opacity
 * hint (see CLAUDE.md's anti-cheat section), or plain masked.
 *
 * Order matters: a found word or a close guess is normal gameplay progress and
 * always takes over from the dev hint, never the other way round.
 */
export function WordToken({ token }: WordTokenProps) {
  if (!token.isWord) return <span>{token.text}</span>;
  if (token.revealed) return <span className="token-word-found">{token.text}</span>;

  if (token.near) {
    const { text, score } = token.near;
    const letters = token.text.length;
    return (
      <span
        className={`token-word-near tier-${proximityTier({ found: false, score })}`}
        style={heatStyle(score)}
        title={`« ${text} » est proche de ce mot (${score}/100) — ${letters} lettre${letters === 1 ? "" : "s"}`}
      >
        {/* The word's own blank stays in the layout, invisible, so the slot is never narrower than the word it hides. */}
        <span className="token-near-blank" aria-hidden="true">
          {token.text}
        </span>
        <span className="token-near-guess">{text}</span>
      </span>
    );
  }

  if (token.devHint) {
    return (
      <span className="token-word-devhint" title="Indice de dev (DEV_REVEAL_LYRICS) : mot pas encore trouvé">
        {token.devHint}
      </span>
    );
  }

  return <span className="token-word-hidden">{token.text}</span>;
}

import { memo } from "react";
import type { SlotSection } from "../game/slots";
import { WordToken } from "./WordToken";

interface LyricsBodyProps {
  sections: SlotSection[];
  /** True once the player has checked "show all lyrics" on a won round - see TitleGuess and GameScreen. */
  revealAll?: boolean;
}

/**
 * Memoized, and given a `sections` array that only changes when the round
 * does (see GameScreen): the lyrics are the biggest thing on the page and have
 * nothing to do with the word being typed, so a keystroke must not re-render a
 * single token. Guarded by tests/unit/components/gameScreen.test.tsx. Toggling
 * `revealAll` is a deliberate, explicit action rather than a keystroke, so it
 * re-rendering every token is expected.
 */
export const LyricsBody = memo(function LyricsBody({ sections, revealAll = false }: LyricsBodyProps) {
  return (
    <div className="lyrix-lyrics">
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          <p className="lyrix-section-label">{section.label}</p>
          {section.lines.map((line, lineIndex) => (
            <p className="lyrix-lyric-line" key={lineIndex}>
              {line.tokens.map((token, tokenIndex) => (
                <WordToken key={tokenIndex} token={token} revealAll={revealAll} />
              ))}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
});

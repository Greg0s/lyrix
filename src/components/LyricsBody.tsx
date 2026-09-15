import { memo } from "react";
import type { SlotSection } from "../game/slots";
import { WordToken } from "./WordToken";

interface LyricsBodyProps {
  sections: SlotSection[];
}

/**
 * Memoized, and given a `sections` array that only changes when the round
 * does (see GameScreen): the lyrics are the biggest thing on the page and have
 * nothing to do with the word being typed, so a keystroke must not re-render a
 * single token. Guarded by tests/unit/components/gameScreen.test.tsx.
 */
export const LyricsBody = memo(function LyricsBody({ sections }: LyricsBodyProps) {
  return (
    <div className="lyrix-lyrics">
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          <p className="lyrix-section-label">{section.label}</p>
          {section.lines.map((line, lineIndex) => (
            <p className="lyrix-lyric-line" key={lineIndex}>
              {line.tokens.map((token, tokenIndex) => (
                <WordToken key={tokenIndex} token={token} />
              ))}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
});

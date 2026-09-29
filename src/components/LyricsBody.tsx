import { memo } from "react";
import type { SlotSection } from "../game/slots";
import { TokenRun } from "./TokenRun";

interface LyricsBodyProps {
  sections: SlotSection[];
  /** True once the player has checked "show all lyrics" on a won round - see TitleGuess and GameScreen. */
  revealAll?: boolean;
  /** See WordToken: highlights every occurrence of the word the latest guess found. */
  lastFoundKey?: string | null;
}

/**
 * Memoized, and given a `sections` array that only changes when the round
 * does (see GameScreen): the lyrics are the biggest thing on the page and have
 * nothing to do with the word being typed, so a keystroke must not re-render a
 * single token. Guarded by tests/unit/components/gameScreen.test.tsx. Toggling
 * `revealAll` is a deliberate, explicit action rather than a keystroke, and
 * `lastFoundKey` only changes when a guess comes back, so either re-rendering
 * every token is expected.
 */
export const LyricsBody = memo(function LyricsBody({ sections, revealAll = false, lastFoundKey = null }: LyricsBodyProps) {
  return (
    <div className="lyrix-lyrics">
      {sections.map((section, sectionIndex) => (
        <section className="lyrix-section" key={sectionIndex}>
          <p className="lyrix-section-label">{section.label}</p>
          <div className="lyrix-section-lines">
            {section.lines.map((line, lineIndex) => (
              <p className="lyrix-lyric-line" key={lineIndex}>
                <TokenRun tokens={line.tokens} revealAll={revealAll} lastFoundKey={lastFoundKey} />
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});

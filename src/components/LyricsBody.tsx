import { memo, useId } from "react";
import { useRovingBlanks } from "../hooks/useRovingBlanks";
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
 * single token. A guess re-renders only the lines it changed, plus those
 * holding the word highlighted before or after it: each line is a memoized
 * TokenRun, handed the same array when it didn't change (placeNearGuesses).
 * Both guarded by tests/unit/components/gameScreen.test.tsx. Toggling
 * `revealAll` is a deliberate, explicit action rather than a keystroke, so
 * re-rendering every token then is expected. Moving between bars with the
 * arrow keys re-renders nothing: see useRovingBlanks.
 */
export const LyricsBody = memo(function LyricsBody({ sections, revealAll = false, lastFoundKey = null }: LyricsBodyProps) {
  const roving = useRovingBlanks<HTMLDivElement>();
  const hintId = useId();
  return (
    <div
      className="lyrix-lyrics"
      role="group"
      aria-label="Paroles"
      aria-describedby={hintId}
      ref={roving.ref}
      onFocus={roving.onFocus}
      onKeyDown={roving.onKeyDown}
    >
      <p className="sr-only" id={hintId}>
        Flèches pour passer d’un mot caché à l’autre.
      </p>
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

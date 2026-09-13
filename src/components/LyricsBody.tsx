import type { SlotSection } from "../game/slots";
import { WordToken } from "./WordToken";

interface LyricsBodyProps {
  sections: SlotSection[];
}

export function LyricsBody({ sections }: LyricsBodyProps) {
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
}

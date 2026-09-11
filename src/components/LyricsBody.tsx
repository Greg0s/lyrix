import type { DisplaySection } from "../game/types";

interface LyricsBodyProps {
  sections: DisplaySection[];
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
                <span
                  key={tokenIndex}
                  className={token.isWord ? (token.revealed ? "token-word-found" : "token-word-hidden") : undefined}
                >
                  {token.text}
                </span>
              ))}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

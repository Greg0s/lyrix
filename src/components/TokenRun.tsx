import type { CSSProperties } from "react";
import type { SlotToken } from "../game/slots";
import { WordToken } from "./WordToken";

interface TokenRunProps {
  tokens: SlotToken[];
  revealAll?: boolean;
  lastFoundKey?: string | null;
  /** Gives each word its rank in the run as --word, which the title's words pop in turn by once it is won (game.css). */
  rankWords?: boolean;
}

/**
 * One line of the title or the lyrics. Each word is kept on the same line as
 * the punctuation glued to it ("jardin," "l'"), so a line never wraps to
 * start with a lone comma - the bars make that far more visible than text did.
 */
export function TokenRun({ tokens, revealAll, lastFoundKey, rankWords = false }: TokenRunProps) {
  const out = [];
  // Characters of the current (non-word) token already rendered as the previous word's tail.
  let consumed = 0;
  let rank = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] as SlotToken;
    if (!token.isWord) {
      const rest = token.text.slice(consumed);
      consumed = 0;
      if (rest) out.push(<span key={index}>{rest}</span>);
      continue;
    }
    const next = tokens[index + 1];
    const tail = next && !next.isWord ? (/^\S*/.exec(next.text)?.[0] ?? "") : "";
    consumed = tail.length;
    out.push(
      <span className="token-nowrap" key={index} style={rankWords ? ({ "--word": rank } as CSSProperties) : undefined}>
        <WordToken token={token} revealAll={revealAll} lastFoundKey={lastFoundKey} />
        {tail}
      </span>
    );
    rank += 1;
  }
  return <>{out}</>;
}

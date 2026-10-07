import { memo, type CSSProperties } from "react";
import { normalize } from "../game/normalize";
import type { SlotToken } from "../game/slots";
import { WordToken } from "./WordToken";

interface TokenRunProps {
  tokens: SlotToken[];
  revealAll?: boolean;
  lastFoundKey?: string | null;
  /** Gives each word its rank in the run as --word, which the title's words pop in turn by once it is won (game.css). */
  rankWords?: boolean;
}

// The keys of a line's revealed words, worked out once per line: a line's
// tokens are never changed in place, only replaced (see placeNearGuesses).
const revealedKeysOf = new WeakMap<SlotToken[], ReadonlySet<string>>();

function revealedKeys(tokens: SlotToken[]): ReadonlySet<string> {
  let keys = revealedKeysOf.get(tokens);
  if (!keys) {
    keys = new Set(tokens.filter((token) => token.isWord && token.revealed).map((token) => normalize(token.text)));
    revealedKeysOf.set(tokens, keys);
  }
  return keys;
}

/**
 * A line only renders again when it changed, or when the word highlighted as
 * the last one found (WordToken) is, or was, among its own: a guess re-renders
 * the lines it touched, not the song.
 */
function sameRun(before: TokenRunProps, after: TokenRunProps): boolean {
  if (before.tokens !== after.tokens || before.revealAll !== after.revealAll || before.rankWords !== after.rankWords) {
    return false;
  }
  if (before.lastFoundKey === after.lastFoundKey) return true;
  const keys = revealedKeys(after.tokens);
  return !(before.lastFoundKey && keys.has(before.lastFoundKey)) && !(after.lastFoundKey && keys.has(after.lastFoundKey));
}

/**
 * One line of the title or the lyrics. Each word is kept on the same line as
 * the punctuation glued to it ("jardin," "l'"), so a line never wraps to
 * start with a lone comma - the bars make that far more visible than text did.
 */
export const TokenRun = memo(function TokenRun({ tokens, revealAll, lastFoundKey, rankWords = false }: TokenRunProps) {
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
}, sameRun);

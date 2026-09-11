import type { TriedWord } from "../hooks/useGame";

interface TriedWordsProps {
  triedWords: TriedWord[];
}

export function TriedWords({ triedWords }: TriedWordsProps) {
  return (
    <div className="lyrix-tried-list">
      {triedWords.map((word) => (
        <span key={word.key} className={`lyrix-chip ${word.found ? "is-found" : "is-missed"}`}>
          {word.display}
        </span>
      ))}
      {triedWords.length === 0 ? <p className="lyrix-empty">Rien pour l'instant…</p> : null}
    </div>
  );
}

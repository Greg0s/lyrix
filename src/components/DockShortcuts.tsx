import { memo, useMemo, type MouseEvent } from "react";
import { hintCardText, HINT_IDS } from "../game/hints";
import type { RoundHints } from "../game/types";
import { BulbIcon } from "./HintIcon";

interface DockShortcutsProps {
  /** Every guess so far, found or not: the "Tes mots" card's count. */
  triedCount: number;
  /** The round's hints, absent for a round that has none. */
  hints: RoundHints | undefined;
  victory: boolean;
  /** In a room: the words are the group's. */
  group: boolean;
  /** Stable (GameScreen), so typing a guess never re-renders the buttons. */
  onOpenWords: () => void;
  onOpenHints: () => void;
}

/**
 * Two buttons atop the guess dock, below 880px only (game.css), where the side
 * column's cards are out of the page: the words tried and the hints, each
 * opening its card as a sheet. The hints' button says when one is waiting.
 */
export const DockShortcuts = memo(function DockShortcuts({
  triedCount,
  hints,
  victory,
  group,
  onOpenWords,
  onOpenHints,
}: DockShortcutsProps) {
  const text = useMemo(() => (hints ? hintCardText(hints, { victory, group }) : null), [hints, victory, group]);
  const words = `${triedCount} mot${triedCount < 2 ? "" : "s"}`;
  // As "Valider" (GuessForm): a press never takes focus from the input. With the
  // keyboard up, the input losing focus would bring the tab bar back and move
  // the dock up under the finger, before the press ends: the tap would miss.
  const keepInputFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();
  return (
    <div className="lyrix-dock-shortcuts">
      <button
        type="button"
        className="lyrix-dock-shortcut"
        onClick={onOpenWords}
        onMouseDown={keepInputFocus}
        data-tour="words"
        aria-label={`${group ? "Mots du groupe" : "Tes mots"} : ${words}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="8" height="5" rx="2.5" />
          <rect x="13" y="5" width="8" height="5" rx="2.5" />
          <rect x="3" y="14" width="11" height="5" rx="2.5" />
        </svg>
        <span aria-hidden="true">
          <b>{triedCount}</b> mot{triedCount < 2 ? "" : "s"}
        </span>
      </button>
      {hints && text ? (
        <button
          type="button"
          className={`lyrix-dock-shortcut${text.badge ? " is-waiting" : ""}`}
          onClick={onOpenHints}
          onMouseDown={keepInputFocus}
          data-tour="hints"
          aria-label={`Indices : ${text.badge ?? `${hints.used.length} sur ${HINT_IDS.length}`}`}
        >
          <BulbIcon />
          <span aria-hidden="true">
            Indices <b>{text.badge ?? `${hints.used.length}/${HINT_IDS.length}`}</b>
          </span>
        </button>
      ) : null}
    </div>
  );
});

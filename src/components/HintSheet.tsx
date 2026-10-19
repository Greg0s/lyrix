import { hintCardText, hintRows } from "../game/hints";
import type { HintId, RoundHints } from "../game/types";
import { HintIcon } from "./HintIcon";
import { Modal } from "./Modal";

interface HintSheetProps {
  hints: RoundHints;
  /** The round is a room's: its hints are revealed for everyone. */
  group: boolean;
  onReveal: (id: HintId) => void;
  onClosed: () => void;
}

/**
 * Picking a hint from the dock's "Choisir" (a phone, where the hints card is
 * collapsed far above): the hints that can be picked, as a sheet from the
 * bottom of the screen. Picking one closes it; the dock then says what it was.
 */
export function HintSheet({ hints, group, onReveal, onClosed }: HintSheetProps) {
  const text = hintCardText(hints, { victory: false, group });
  const choices = hintRows(hints, false).filter((row) => row.kind === "choice");
  return (
    <Modal title="Choisis un indice" onClosed={onClosed} variant="sheet">
      {(requestClose) => (
        <>
          {group ? <p className="lyrix-sheet-text">{text.intro}</p> : null}
          {text.footer ? <p className="lyrix-sheet-text">{text.footer}</p> : null}
          <ul className="lyrix-hints-list">
            {choices.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="lyrix-hint is-choice"
                  onClick={() => {
                    onReveal(row.id);
                    requestClose();
                  }}
                >
                  <span className="lyrix-hint-icon" aria-hidden="true">
                    <HintIcon id={row.id} />
                  </span>
                  <span className="lyrix-hint-name">{row.label}</span>
                  <span className="lyrix-hint-action">Révéler</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="lyrix-sheet-later" onClick={requestClose}>
            Plus tard
          </button>
        </>
      )}
    </Modal>
  );
}

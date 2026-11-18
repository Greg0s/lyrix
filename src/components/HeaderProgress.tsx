import { memo } from "react";
import { plural } from "./plural";

interface HeaderProgressProps {
  /** Share of the round's words revealed so far, 0-100 (as the progress card's). */
  percent: number;
  foundCount: number;
  triedCount: number;
}

/**
 * The round's progress in the header, below 880px only (game.css), where the
 * side column's cards are out of the page: the percent in big over a bar
 * the header's width, the words found and the tries beside it. The progress
 * card says the same from 880px up.
 */
export const HeaderProgress = memo(function HeaderProgress({ percent, foundCount, triedCount }: HeaderProgressProps) {
  return (
    <div className="lyrix-header-progress" role="group" aria-label="Progression">
      <div className="lyrix-header-progress-top">
        <span className="lyrix-header-progress-value">{percent}&nbsp;%</span>
        <span className="lyrix-header-progress-stats">
          <b>{foundCount}</b> {plural(foundCount, "trouvé", "trouvés")} · <b>{triedCount}</b>{" "}
          {plural(triedCount, "essai", "essais")}
        </span>
      </div>
      <div className="lyrix-header-progress-track" aria-hidden="true">
        <div className="lyrix-header-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
});

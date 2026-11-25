import { memo } from "react";
import { plural } from "./plural";

interface ProgressCardProps {
  /** Share of the round's words (title and lyrics, every occurrence) revealed so far, 0-100. */
  percent: number;
  foundCount: number;
  triedCount: number;
}


export const ProgressCard = memo(function ProgressCard({ percent, foundCount, triedCount }: ProgressCardProps) {
  return (
    <section className="lyrix-card lyrix-progress" aria-label="Progression">
      <div className="lyrix-progress-head">
        <h2 className="lyrix-card-title">Progression</h2>
        <span className="lyrix-progress-value">{percent}&nbsp;%</span>
      </div>
      <div
        className="lyrix-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Paroles dévoilées"
      >
        <div className="lyrix-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="lyrix-stats">
        <p className="lyrix-stat" data-stat="found">
          <span className="lyrix-stat-value">{foundCount}</span>{" "}
          <span className="lyrix-stat-label">{plural(foundCount, "mot trouvé", "mots trouvés")}</span>
        </p>
        <p className="lyrix-stat" data-stat="tried">
          <span className="lyrix-stat-value">{triedCount}</span>{" "}
          <span className="lyrix-stat-label">{plural(triedCount, "essai", "essais")}</span>
        </p>
      </div>
    </section>
  );
});

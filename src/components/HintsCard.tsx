import { memo, useMemo } from "react";
import { EVENTS, track } from "../analytics";
import { hintCardText, hintRows } from "../game/hints";
import { memberName, type RoomHint } from "../game/room";
import type { HintId, RoundHints } from "../game/types";
import { HintIcon, LockIcon } from "./HintIcon";
import { playerStyle } from "./playerColor";

interface HintsCardProps {
  hints: RoundHints;
  victory: boolean;
  /** In a room: who revealed each hint, and the player's own id. Null in solo play. */
  group: { you: string; hints: RoomHint[] } | null;
  /** A hint is on its way: the buttons are inert until it lands. */
  revealing: boolean;
  /** Stable across renders (useGame), so the card skips rendering while the player types. */
  onReveal: (id: HintId) => void;
  /** In a sheet (below 880px, from the dock's "Indices"): the card's body alone, under the sheet's own title. */
  inSheet?: boolean;
}

/**
 * The "Indices" card (src/game/hints.ts): one row per hint, a button while it
 * can be picked, its text once revealed, locked until a threshold allows it;
 * then how far the next one is. Under "Tes mots" in the side column from
 * 880px; below, where the side column is out of the page, as a sheet the
 * dock's "Indices" button opens (DockShortcuts, `inSheet`), which says when a
 * hint is waiting.
 */
export const HintsCard = memo(function HintsCard({
  hints,
  victory,
  group,
  revealing,
  onReveal,
  inSheet = false,
}: HintsCardProps) {
  const inRoom = group !== null;
  const text = useMemo(() => hintCardText(hints, { victory, group: inRoom }), [hints, victory, inRoom]);
  const rows = useMemo(() => hintRows(hints, victory), [hints, victory]);
  const meter = text.meter;
  const meterShare = meter ? Math.min(100, Math.round(((meter.now - meter.from) / (meter.to - meter.from)) * 100)) : 0;

  const body = (
    <div className="lyrix-hints-body">
      {text.intro ? <p className="lyrix-hints-intro">{text.intro}</p> : null}
      <ul className="lyrix-hints-list">
        {rows.map((row) => {
          if (row.kind === "choice") {
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="lyrix-hint is-choice"
                  aria-disabled={revealing}
                  {...track(EVENTS.revealHint, { hint: row.id, from: "card" })}
                  onClick={() => {
                    if (!revealing) onReveal(row.id);
                  }}
                >
                  <span className="lyrix-hint-icon" aria-hidden="true">
                    <HintIcon id={row.id} />
                  </span>
                  <span className="lyrix-hint-name">{row.label}</span>
                  <span className="lyrix-hint-action">Révéler</span>
                </button>
              </li>
            );
          }
          if (row.kind === "locked") {
            return (
              <li key={row.id} className="lyrix-hint is-locked">
                <span className="lyrix-hint-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <span className="lyrix-hint-name">{row.label}</span>
                <span className="lyrix-visually-hidden"> (verrouillé)</span>
              </li>
            );
          }
          const by = group?.hints.find((hint) => hint.id === row.id)?.by;
          return (
            <li key={row.id} className={`lyrix-hint is-${row.kind}`}>
              <span className="lyrix-hint-icon" aria-hidden="true">
                <HintIcon id={row.id} />
              </span>
              <span className="lyrix-hint-text">
                <span className="lyrix-hint-label">{row.label}</span>
                <span className="lyrix-hint-value">{row.value}</span>
                {by && group ? (
                  <span className="lyrix-hint-by">
                    <span className="lyrix-player-dot" style={playerStyle(by, group.you)} aria-hidden="true" />
                    choisi par {memberName(by, group.you)}
                  </span>
                ) : null}
              </span>
              {row.kind === "unused" ? <span className="lyrix-hint-tag">non utilisé</span> : null}
            </li>
          );
        })}
      </ul>
      {meter ? (
        <div className="lyrix-hints-meter">
          <div className="lyrix-hints-meter-head">
            <span>{meter.label}</span>
            <span className="lyrix-hints-meter-count">
              {meter.now} / {meter.to} essais
            </span>
          </div>
          <div
            className="lyrix-hints-track"
            role="progressbar"
            aria-label={meter.label}
            aria-valuemin={meter.from}
            aria-valuemax={meter.to}
            aria-valuenow={meter.now}
          >
            <div className="lyrix-hints-fill" style={{ width: `${meterShare}%` }} />
          </div>
        </div>
      ) : null}
      {text.footer ? <p className={`lyrix-hints-footer${text.proud ? " is-proud" : ""}`}>{text.footer}</p> : null}
    </div>
  );
  if (inSheet) return <div className="lyrix-hints is-in-sheet">{body}</div>;

  return (
    <section
      className={`lyrix-card lyrix-hints${text.badge ? " is-waiting" : ""}`}
      aria-label="Indices"
      data-tour="hints"
    >
      <h2 className="lyrix-hints-heading">
        <span className="lyrix-card-title">Indices</span>
        {text.badge ? (
          <span className="lyrix-hints-badge">{text.badge}</span>
        ) : (
          <span className="lyrix-hints-counter">{text.counter}</span>
        )}
      </h2>
      {body}
    </section>
  );
});

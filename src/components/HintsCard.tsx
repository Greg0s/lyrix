import { memo, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
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
}

/**
 * The "Indices" card (src/game/hints.ts): one row per hint, a button while it
 * can be picked, its text once revealed, locked until a threshold allows it;
 * then how far the next one is. Under "Tes mots" in the side column, where it
 * is always open from 880px; on a phone it starts collapsed to its header,
 * which still says when a hint is waiting, and the dock offers to pick it.
 * Open/closed is local state, so toggling it never re-renders the lyrics.
 */
export const HintsCard = memo(function HintsCard({ hints, victory, group, revealing, onReveal }: HintsCardProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  // As in TriedWords: the header stays where it was tapped, the card opens downward.
  const tappedTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    const top = tappedTop.current;
    tappedTop.current = null;
    const toggle = toggleRef.current;
    if (top === null || !toggle) return;
    const shift = toggle.getBoundingClientRect().top - top;
    if (shift !== 0) window.scrollBy(0, shift);
  }, [open]);

  const inRoom = group !== null;
  const text = useMemo(() => hintCardText(hints, { victory, group: inRoom }), [hints, victory, inRoom]);
  const rows = useMemo(() => hintRows(hints, victory), [hints, victory]);
  const meter = text.meter;
  const meterShare = meter ? Math.min(100, Math.round(((meter.now - meter.from) / (meter.to - meter.from)) * 100)) : 0;

  return (
    <section
      className={`lyrix-card lyrix-hints${open ? " is-open" : ""}${text.badge ? " is-waiting" : ""}`}
      aria-label="Indices"
    >
      <h2 className="lyrix-hints-heading">
        <button
          type="button"
          className="lyrix-hints-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          ref={toggleRef}
          onClick={(event) => {
            tappedTop.current = event.currentTarget.getBoundingClientRect().top;
            setOpen((value) => !value);
          }}
        >
          <span className="lyrix-card-title">Indices</span>
          {text.badge ? (
            <span className="lyrix-hints-badge">{text.badge}</span>
          ) : (
            <span className="lyrix-hints-counter">{text.counter}</span>
          )}
          <span className="lyrix-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      </h2>
      <div className="lyrix-hints-body" id={bodyId}>
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
    </section>
  );
});

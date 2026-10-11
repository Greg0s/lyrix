import { memo } from "react";

/** How long the logo takes to leave: its last letter's delay plus its own animation (game.css). */
export const LOGO_EXIT_MS = 480;

/**
 * The logo mark (three lines of lyrics, some words masked as accent bars) and
 * the "Lyrıx" wordmark, whose dotless ı carries an accent bar for a dot. Pure
 * CSS, no image: see game.css.
 *
 * It comes in as it mounts (the "Lyrix Logo Animations" mockup's 1b): the
 * mark's lines write themselves in reading order, two of their words turning
 * into accent bars, then the letters rise one by one and the dot drops onto
 * the ı. Remounting it plays it again (AppHeader, on a click).
 *
 * It leaves first (the mockup's exit C, "Défilement"), while `leaving`: the
 * rise it came in with keeps going, like lyrics scrolling past. The mark's
 * lines scroll out of it, the letters rise away, then the empty mark closes.
 */
export const Logo = memo(function Logo({ leaving = false }: { leaving?: boolean }) {
  return (
    <span className={leaving ? "lyrix-logo is-leaving" : "lyrix-logo"}>
      <span className="lyrix-logo-mark" aria-hidden="true">
        <span className="lyrix-logo-row">
          <span className="is-word is-short" />
          <span className="is-bar is-fill" />
        </span>
        <span className="lyrix-logo-row">
          <span className="is-bar is-medium" />
          <span className="is-word is-fill" />
        </span>
        <span className="lyrix-logo-row">
          <span className="is-word is-long" />
        </span>
      </span>
      <span className="lyrix-wordmark" aria-label="Lyrix">
        <span aria-hidden="true">
          <span className="lyrix-wordmark-letter">L</span>
          <span className="lyrix-wordmark-letter">y</span>
          <span className="lyrix-wordmark-letter">r</span>
          <span className="lyrix-wordmark-letter lyrix-wordmark-i">
            ı<span className="lyrix-wordmark-dot" />
          </span>
          <span className="lyrix-wordmark-letter">x</span>
        </span>
      </span>
    </span>
  );
});

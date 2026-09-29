import { memo } from "react";

/**
 * The logo mark (three lines of lyrics, some words masked as accent bars) and
 * the "Lyrıx" wordmark, whose dotless ı carries an accent bar for a dot. Pure
 * CSS, no image: see game.css.
 */
export const Logo = memo(function Logo() {
  return (
    <span className="lyrix-logo">
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
          Lyr
          <span className="lyrix-wordmark-i">
            ı<span className="lyrix-wordmark-dot" />
          </span>
          x
        </span>
      </span>
    </span>
  );
});

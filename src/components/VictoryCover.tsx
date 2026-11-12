import { memo, useState } from "react";
import { apiUrl } from "../api/base";

interface VictoryCoverProps {
  /** The song's cover token (RoundView.cover); absent for a song that can't have one. */
  cover?: string;
  /** The song's release year (RoundView.year), written on the sleeve. */
  year?: number;
}

/**
 * The victory panel's sleeve: the song's album cover, asked of the Worker
 * (worker/src/covers.ts), never of anyone else. Until the image has loaded,
 * and for good when there is none (404) or it couldn't be had, an orange
 * sleeve shows the song's year, a record peeking out of it. Decorative: the
 * panel's text says the artist and year already.
 */
export const VictoryCover = memo(function VictoryCover({ cover, year }: VictoryCoverProps) {
  // Which cover's image has loaded, so another song's shows its sleeve until its own has.
  const [loaded, setLoaded] = useState<string | null>(null);
  const shown = cover !== undefined && loaded === cover;
  return (
    <div className={shown ? "lyrix-victory-cover has-image" : "lyrix-victory-cover"} aria-hidden="true">
      {year !== undefined ? <span className="lyrix-victory-cover-year">{year}</span> : null}
      {cover !== undefined ? (
        <img
          key={cover}
          src={apiUrl(`/api/cover/${encodeURIComponent(cover)}`).href}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(cover)}
        />
      ) : null}
    </div>
  );
});

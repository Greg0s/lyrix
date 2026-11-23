import { memo, type ReactNode, useState } from "react";
import { coverUrl } from "./coverUrl";

interface VictoryCoverProps {
  /** The song's cover token (RoundView.cover); absent for a song that can't have one. */
  cover?: string;
  /** Laid over the sleeve: the extract's player, in one of its proposals (VictoryPreview). */
  children?: ReactNode;
}

/**
 * The victory panel's sleeve: the song's album cover, asked of the Worker
 * (worker/src/covers.ts), never of anyone else. Nothing takes its place:
 * it only shows once the image has loaded, and goes for good when there is
 * none (404) or it couldn't be had (decided with the developer). Decorative:
 * the panel's text names the song, its artist and year.
 */
export const VictoryCover = memo(function VictoryCover({ cover, children }: VictoryCoverProps) {
  // Which cover's image has loaded, or failed: another song's waits for its own.
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (cover === undefined || failed === cover) return null;
  return (
    // Decorative, but for a player laid over it, which must stay reachable.
    <div
      className={loaded === cover ? "lyrix-victory-cover has-image" : "lyrix-victory-cover"}
      aria-hidden={children ? undefined : "true"}
    >
      <img
        key={cover}
        src={coverUrl(cover)}
        alt=""
        decoding="async"
        onLoad={() => setLoaded(cover)}
        onError={() => setFailed(cover)}
      />
      {children}
    </div>
  );
});

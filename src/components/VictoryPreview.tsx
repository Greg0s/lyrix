import { memo, useRef, useState } from "react";
import { EVENTS, track } from "../analytics";
import { apiUrl } from "../api/base";

interface VictoryPreviewProps {
  /** The song's token (RoundView.cover), which its cover and its extract are both asked for by. */
  cover: string;
}

/** How long an extract lasts, until its metadata says otherwise. */
const PREVIEW_SECONDS = 30;

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {playing ? (
        <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />
      ) : (
        <path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z" />
      )}
    </svg>
  );
}

/**
 * The song's 30-second extract, once won, as a record out of its sleeve
 * (decided with the developer): Deezer's preview, served by the Worker
 * (worker/src/preview.ts), never by Deezer itself. Like the sleeve, it only
 * shows once the browser knows the extract is there (its metadata loaded),
 * and goes for good when there is none. Never plays unasked.
 *
 * The record is one button, and its hit area reaches back under the sleeve
 * (game.css): a tap anywhere on either plays or pauses it. While it plays,
 * its sheen turns and a ring round its hole fills with the time played.
 * That progress is written straight to the DOM (a CSS variable): playing
 * re-renders nothing, the panel included.
 */
export const VictoryPreview = memo(function VictoryPreview({ cover }: VictoryPreviewProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Which song's extract plays: another song's (a day of the archives) starts paused.
  const [playingCover, setPlayingCover] = useState<string | null>(null);
  const playing = playingCover === cover;

  if (failed === cover) return null;

  const progress = () => {
    const element = audio.current;
    if (!element) return;
    const duration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : PREVIEW_SECONDS;
    root.current?.style.setProperty("--progress", String(Math.min(1, element.currentTime / duration)));
  };

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      if (element.ended) element.currentTime = 0;
      void element.play().catch(() => setPlayingCover(null));
    } else {
      element.pause();
    }
  };

  return (
    <div
      ref={root}
      className={`lyrix-preview${ready === cover ? " is-ready" : ""}${playing ? " is-playing" : ""}`}
    >
      <audio
        key={cover}
        ref={audio}
        src={apiUrl(`/api/preview/${encodeURIComponent(cover)}`).href}
        preload="metadata"
        onLoadedMetadata={() => setReady(cover)}
        onError={() => setFailed(cover)}
        onPlay={() => setPlayingCover(cover)}
        onPause={() => setPlayingCover(null)}
        onEnded={() => setPlayingCover(null)}
        onTimeUpdate={progress}
      />
      <button
        type="button"
        className="lyrix-vinyl"
        aria-label={playing ? "Mettre l'extrait en pause" : "Écouter un extrait de 30 secondes"}
        onClick={toggle}
        {...track(EVENTS.playPreview)}
      >
        <span className="lyrix-vinyl-sheen" aria-hidden="true" />
        <span className="lyrix-vinyl-hole" aria-hidden="true">
          {/* The time played, as a ring: pathLength 1, so the dash offset is what is left to play. */}
          <svg className="lyrix-vinyl-ring" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" pathLength="1" />
            <circle cx="24" cy="24" r="22" pathLength="1" />
          </svg>
          <PlayIcon playing={playing} />
        </span>
      </button>
    </div>
  );
});

import { memo, useRef, useState } from "react";
import { apiUrl } from "../api/base";
import { coverUrl } from "./coverUrl";

/** Where the player sits on the victory panel (proposals for the developer: A, B or C). */
export type PreviewVariant = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** How the record behaves under a mouse (F): `?disque=1`, `2` or `3`. Mockups only. */
export function sleeveStyle(): 1 | 2 | 3 {
  if (typeof location === "undefined") return 1;
  const asked = new URLSearchParams(location.search).get("disque");
  return asked === "2" ? 2 : asked === "3" ? 3 : 1;
}

/** The proposal shown, from the address (`?extrait=A`); B by default. Mockups only: goes once one is picked. */
export function previewVariant(): PreviewVariant {
  if (typeof location === "undefined") return "B";
  const asked = new URLSearchParams(location.search).get("extrait")?.toUpperCase();
  return asked === "A" || asked === "C" || asked === "D" || asked === "E" || asked === "F" || asked === "G"
    ? asked
    : "B";
}

interface VictoryPreviewProps {
  /** The song's token (RoundView.cover), which its extract is asked for by too. */
  cover?: string;
  variant: PreviewVariant;
}

/** How long an extract lasts, until its metadata says otherwise. */
const PREVIEW_SECONDS = 30;

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function PlayIcon({ playing, size = 18 }: { playing: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {playing ? (
        <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />
      ) : (
        <path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z" />
      )}
    </svg>
  );
}

/**
 * The song's 30-second extract, once won: Deezer's preview, served by the
 * Worker (worker/src/preview.ts), never by Deezer itself. Like the sleeve, it
 * only shows once the browser knows the extract is there (its metadata
 * loaded), and goes for good when there is none. Never plays unasked.
 *
 * Its progress is written straight to the DOM (a CSS variable and the
 * clock's text): playing re-renders nothing, the panel included.
 */
export const VictoryPreview = memo(function VictoryPreview({ cover, variant }: VictoryPreviewProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const elapsed = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Which song's extract plays: another song's (a day of the archives) starts paused.
  const [playingCover, setPlayingCover] = useState<string | null>(null);
  const playing = playingCover !== null && playingCover === cover;

  if (cover === undefined || failed === cover) return null;

  const progress = () => {
    const element = audio.current;
    if (!element) return;
    const duration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : PREVIEW_SECONDS;
    root.current?.style.setProperty("--progress", String(Math.min(1, element.currentTime / duration)));
    if (elapsed.current) elapsed.current.textContent = clock(element.currentTime);
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

  const label = playing ? "Mettre l'extrait en pause" : "Écouter un extrait de 30 secondes";
  const shown = ready === cover;
  const time = (
    <span className="lyrix-preview-time">
      <span ref={elapsed}>0:00</span> / {clock(PREVIEW_SECONDS)}
    </span>
  );

  return (
    <div
      ref={root}
      className={`lyrix-preview is-${variant === "E" ? "d" : variant.toLowerCase()}${shown ? " is-ready" : ""}${playing ? " is-playing" : ""}`}
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
      {variant === "F" ? (
        // The whole record is the button, and its hit area reaches under the sleeve (game.css): a finger can't miss it.
        <button type="button" className="lyrix-vinyl" aria-label={label} onClick={toggle}>
          <span className="lyrix-vinyl-label" style={{ backgroundImage: `url(${coverUrl(cover)})` }} aria-hidden="true" />
          <span className="lyrix-vinyl-hole" aria-hidden="true">
            <PlayIcon playing={playing} size={16} />
          </span>
        </button>
      ) : variant === "G" ? (
        <>
          <button type="button" className="lyrix-preview-button" aria-label={label} onClick={toggle}>
            <PlayIcon playing={playing} size={24} />
          </button>
          <span className="lyrix-preview-bar" aria-hidden="true" />
          {time}
        </>
      ) : variant === "D" || variant === "E" ? (
        <button type="button" className="lyrix-preview-button" aria-label={label} onClick={toggle}>
          {/* Its progress, as a ring around it: pathLength 1, so the dash offset is what is left to play. */}
          <svg className="lyrix-preview-ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="18" pathLength="1" />
            <circle cx="20" cy="20" r="18" pathLength="1" />
          </svg>
          <PlayIcon playing={playing} size={14} />
        </button>
      ) : variant === "A" ? (
        <>
          <button type="button" className="lyrix-preview-button" aria-label={label} onClick={toggle}>
            <PlayIcon playing={playing} size={20} />
          </button>
          <span className="lyrix-preview-bar" aria-hidden="true" />
        </>
      ) : variant === "B" ? (
        <>
          <button type="button" className="lyrix-preview-button" aria-label={label} onClick={toggle}>
            <PlayIcon playing={playing} size={16} />
          </button>
          <span className="lyrix-preview-bar" aria-hidden="true" />
          {time}
        </>
      ) : (
        <>
          <button type="button" className="lyrix-preview-button" aria-label={label} onClick={toggle}>
            <PlayIcon playing={playing} size={18} />
          </button>
          <span className="lyrix-preview-text">
            <span className="lyrix-preview-title">{playing ? "Extrait en cours" : "Écouter un extrait"}</span>
            <span className="lyrix-preview-source">30 secondes, via Deezer</span>
          </span>
          <span className="lyrix-preview-eq" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          {time}
          <span className="lyrix-preview-bar" aria-hidden="true" />
        </>
      )}
    </div>
  );
});

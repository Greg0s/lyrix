import { useEffect, useState } from "react";

/** How long "Copié !" stays up before the button reads its label again. */
export const COPIED_MS = 1600;

interface CopyButtonProps {
  /** What lands in the clipboard (or the share sheet). */
  value: string;
  /** "Copier le code", "Copier le lien"… */
  label: string;
  /** "dark" on the side column's Salon card, "light" in the dialog. */
  tone: "light" | "dark";
  /**
   * On a phone, hand `value` (a link) to the system's share sheet instead of
   * the clipboard, under this label: sending it to a chat is what the player
   * wants to do with it there. Desktop browsers keep the plain copy, their
   * share dialogs being an odd detour for a link.
   */
  shareLabel?: string;
  /**
   * A small round button showing this icon instead of its label, which stays
   * its accessible name and tooltip. A tick replaces the icon while "Copié !".
   */
  icon?: "copy" | "link";
}

type Flash = { kind: "copied" | "failed"; seq: number };

const ICON_PATHS = {
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </>
  ),
  done: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};

function ButtonIcon({ kind }: { kind: keyof typeof ICON_PATHS }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[kind]}
    </svg>
  );
}

/** A phone or tablet that can share: the share sheet is how links travel there. */
function canShare(): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/** Copies a value to the clipboard (or shares it, on a phone), and says so for a moment. */
export function CopyButton({ value, label, tone, shareLabel, icon }: CopyButtonProps) {
  const [flash, setFlash] = useState<Flash | null>(null);
  const [share] = useState(() => shareLabel !== undefined && canShare());

  // Keyed on the whole flash, so a second click restarts the countdown.
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const copy = async () => {
    const seq = (flash?.seq ?? 0) + 1;
    if (share) {
      try {
        await navigator.share({ url: value });
        return;
      } catch (error) {
        // The player closed the sheet: nothing to say. Anything else, copy instead.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      // Undefined outside a secure context: that lands in the catch too.
      await navigator.clipboard.writeText(value);
      setFlash({ kind: "copied", seq });
    } catch {
      setFlash({ kind: "failed", seq });
    }
  };

  const idle = share && shareLabel !== undefined ? shareLabel : label;
  const text = flash?.kind === "copied" ? "Copié !" : flash?.kind === "failed" ? "Copie impossible" : idle;
  return (
    <button
      type="button"
      className={`lyrix-copy is-${tone}${icon ? " is-icon" : ""}${flash?.kind === "copied" ? " is-done" : ""}`}
      onClick={() => void copy()}
      title={icon ? idle : undefined}
      aria-live="polite"
    >
      {icon ? (
        <>
          <ButtonIcon kind={flash?.kind === "copied" ? "done" : icon} />
          <span className="sr-only">{text}</span>
        </>
      ) : (
        text
      )}
    </button>
  );
}

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
  /** Extra class names, for placing the button. */
  className?: string;
}

type Flash = { kind: "copied" | "failed"; seq: number };

/** A phone or tablet that can share: the share sheet is how links travel there. */
function canShare(): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/** Copies a value to the clipboard (or shares it, on a phone), and says so for a moment. */
export function CopyButton({ value, label, tone, shareLabel, className }: CopyButtonProps) {
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
      className={`lyrix-copy is-${tone}${flash?.kind === "copied" ? " is-done" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => void copy()}
      aria-live="polite"
    >
      {text}
    </button>
  );
}

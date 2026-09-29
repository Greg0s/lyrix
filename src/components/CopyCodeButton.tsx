import { useEffect, useState } from "react";

/** How long "Copié !" stays up before the button reads "Copier le code" again. */
export const COPIED_MS = 1600;

interface CopyCodeButtonProps {
  code: string;
  /** "dark" on the side column's Salon card, "light" in the dialog. */
  tone: "light" | "dark";
}

type Flash = { kind: "copied" | "failed"; seq: number };

/** Copies the room code to the clipboard, and says so for a moment. */
export function CopyCodeButton({ code, tone }: CopyCodeButtonProps) {
  const [flash, setFlash] = useState<Flash | null>(null);

  // Keyed on the whole flash, so a second click restarts the countdown.
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const copy = async () => {
    const seq = (flash?.seq ?? 0) + 1;
    try {
      // Undefined outside a secure context: that lands in the catch too.
      await navigator.clipboard.writeText(code);
      setFlash({ kind: "copied", seq });
    } catch {
      setFlash({ kind: "failed", seq });
    }
  };

  const label = flash?.kind === "copied" ? "Copié !" : flash?.kind === "failed" ? "Copie impossible" : "Copier le code";
  return (
    <button
      type="button"
      className={`lyrix-copy is-${tone}${flash?.kind === "copied" ? " is-done" : ""}`}
      onClick={() => void copy()}
      aria-live="polite"
    >
      {label}
    </button>
  );
}

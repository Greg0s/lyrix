/** Safari's "Partager" button, as iOS draws it: a box with an arrow out of it. */
export function ShareIcon() {
  return (
    <svg
      className="lyrix-install-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M7.5 7.5 12 3l4.5 4.5" />
      <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
    </svg>
  );
}

/** The icon of Safari's "Sur l'écran d'accueil": a plus in a rounded square. */
export function AddToHomeIcon() {
  return (
    <svg
      className="lyrix-install-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

/** How to install from Safari on iOS, which has no prompt to open: its two taps. */
export function IosInstallSteps({ className = "" }: { className?: string }) {
  return (
    <ol className={`lyrix-install-steps ${className}`.trim()}>
      <li>
        Touche{" "}
        <span className="lyrix-install-key">
          <ShareIcon /> Partager
        </span>{" "}
        dans la barre de Safari
      </li>
      <li>
        Puis{" "}
        <span className="lyrix-install-key">
          <AddToHomeIcon /> Sur l'écran d'accueil
        </span>
      </li>
    </ol>
  );
}

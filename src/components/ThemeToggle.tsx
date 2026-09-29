import { memo, useEffect, useState } from "react";
import { applyTheme, currentTheme, saveTheme, watchSystemTheme, type Theme } from "../theme";

/**
 * The header's sun/moon button. The theme is its own local state - nothing
 * else in the app reads it, the palette switches in CSS - so toggling it
 * re-renders this button and nothing else.
 */
export const ThemeToggle = memo(function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(
    () =>
      watchSystemTheme((next) => {
        applyTheme(next);
        setTheme(next);
      }),
    []
  );

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
    setTheme(next);
  };

  const label = theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre";
  return (
    <button type="button" className="lyrix-theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
});

function SunIcon() {
  return (
    <svg className="lyrix-theme-icon" {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="lyrix-theme-icon" {...ICON_PROPS}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

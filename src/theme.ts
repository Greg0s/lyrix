/**
 * Light or dark. Until the player picks one with the header's toggle, the
 * page follows the system setting (and keeps following it live); once they
 * do, their choice is kept in localStorage and wins over the system.
 *
 * The theme is a `data-theme` attribute on <html>, which tokens.css keys its
 * dark palette on. index.html sets it with an inline script before the first
 * paint - a module script runs too late and the page would flash light - so
 * that script repeats `initialTheme` in plain JavaScript;
 * tests/unit/theme.test.ts keeps the two in step.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "lyrix:theme";

/** The browser chrome's colour (<meta name="theme-color">): each theme's --color-page-bg, as hex. */
export const THEME_COLORS: Record<Theme, string> = {
  light: "#f7f1e7",
  dark: "#140e0a",
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** The player's own choice, if they made one. */
export function storedTheme(storage: Storage | undefined = globalThis.localStorage): Theme | null {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function initialTheme(storage: Storage | undefined = globalThis.localStorage): Theme {
  return storedTheme(storage) ?? systemTheme();
}

/** The theme on the page right now (index.html set it before React loaded). */
export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return isTheme(value) ? value : initialTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function saveTheme(theme: Theme, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing, quota: the choice just lasts until the tab closes.
  }
}

/**
 * Calls `onChange` whenever the system switches between light and dark, for
 * as long as the player hasn't picked a theme of their own. Returns the
 * unsubscribe function.
 */
export function watchSystemTheme(onChange: (theme: Theme) => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => {
    if (storedTheme() === null) onChange(event.matches ? "dark" : "light");
  };
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

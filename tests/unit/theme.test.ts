// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cssColorToHex } from "../../scripts/lib/favicon";
import { NEAR_MIN_OPACITY } from "../../src/game/similarity";
import {
  applyTheme,
  initialTheme,
  saveTheme,
  storedTheme,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  watchSystemTheme,
  type Theme,
} from "../../src/theme";

// Paths from the repo root: under jsdom, import.meta.url is no longer a file: URL.
const ROOT = resolve(__dirname, "../..");
const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
const tokensCss = readFileSync(resolve(ROOT, "src/styles/tokens.css"), "utf8");
const styleSheets = ["tokens", "global", "game"].map((name) =>
  readFileSync(resolve(ROOT, `src/styles/${name}.css`), "utf8")
);

const bootScript = /<script id="lyrix-theme-boot">([\s\S]*?)<\/script>/.exec(html)?.[1];

type ChangeListener = (event: { matches: boolean }) => void;

/** A system that prefers `dark` or not, and can switch while the page is open. */
function stubSystem(prefersDark: boolean) {
  const listeners = new Set<ChangeListener>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && prefersDark,
    media: query,
    addEventListener: (_: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: ChangeListener) => listeners.delete(listener),
  }));
  return {
    switchTo(dark: boolean) {
      for (const listener of listeners) listener({ matches: dark });
    },
    listenerCount: () => listeners.size,
  };
}

function runBootScript() {
  if (!bootScript) throw new Error("index.html has no #lyrix-theme-boot script");
  new Function(bootScript)();
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} rule in tokens.css`);
  return css.slice(start, css.indexOf("\n}", start));
}

function declaredTokens(css: string): Map<string, string> {
  return new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

beforeEach(() => {
  window.localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#f7f1e7" />';
  delete document.documentElement.dataset.theme;
});

afterEach(() => vi.unstubAllGlobals());

describe("the theme a page opens with", () => {
  it.each<[string, string | null, boolean, Theme]>([
    ["no choice, light system", null, false, "light"],
    ["no choice, dark system", null, true, "dark"],
    ["chose dark on a light system", "dark", false, "dark"],
    ["chose light on a dark system", "light", true, "light"],
    ["an unreadable stored value", "sepia", true, "dark"],
  ])("%s: index.html's boot script and initialTheme() agree", (_, stored, prefersDark, expected) => {
    stubSystem(prefersDark);
    if (stored) window.localStorage.setItem(THEME_STORAGE_KEY, stored);

    runBootScript();

    expect(initialTheme()).toBe(expected);
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(THEME_COLORS[expected]);
  });

  it("is light when the browser can't tell (no matchMedia)", () => {
    vi.stubGlobal("matchMedia", undefined);
    runBootScript();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(initialTheme()).toBe("light");
  });

  it("still opens when storage throws (blocked site data)", () => {
    stubSystem(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    runBootScript();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(storedTheme()).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("switching theme", () => {
  it("puts the palette and the browser chrome's colour on the page", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(THEME_COLORS.dark);

    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(THEME_COLORS.light);
  });

  it("follows the system live until the player picks a theme, then ignores it", () => {
    const system = stubSystem(false);
    const seen: Theme[] = [];
    const stop = watchSystemTheme((theme) => seen.push(theme));

    system.switchTo(true);
    expect(seen).toEqual(["dark"]);

    saveTheme("light");
    system.switchTo(false);
    system.switchTo(true);
    expect(seen).toEqual(["dark"]);

    stop();
    expect(system.listenerCount()).toBe(0);
  });
});

describe("the palette", () => {
  const light = declaredTokens(block(tokensCss, ":root"));
  const dark = declaredTokens(block(tokensCss, ':root[data-theme="dark"]'));

  it("gives the browser chrome each theme's page background", () => {
    expect(THEME_COLORS.light).toBe(cssColorToHex(light.get("--color-page-bg") ?? ""));
    expect(THEME_COLORS.dark).toBe(cssColorToHex(dark.get("--color-page-bg") ?? ""));
    expect(html).toContain(`"${THEME_COLORS.dark}"`);
  });

  it("only overrides tokens the light theme defines, so nothing exists in one theme alone", () => {
    const strays = [...dark.keys()].filter((name) => !light.has(name));
    expect(strays).toEqual([]);
  });

  it("defines every token the stylesheets use", () => {
    const used = new Set(styleSheets.flatMap((css) => [...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])));
    // Set inline by components, per element: a player's colour, a score's heat,
    // a close guess's opacity,
    // a title word's rank and the title's word count on a win, a confetti piece's flight,
    // the size an archived song's title fits its cover at.
    const inline = new Set([
      "--cover-title-size",
      "--player",
      "--heat",
      "--near-opacity",
      "--to-warm",
      "--to-hot",
      "--word",
      "--words",
      "--dx",
      "--rise",
      "--fall",
      "--spin",
      "--flip",
      "--delay",
      "--time",
    ]);
    const undefinedTokens = [...used].filter((name) => !light.has(name) && !inline.has(name));
    expect(undefinedTokens).toEqual([]);
  });

  it("never writes a raw colour in a component stylesheet", () => {
    const raw = styleSheets
      .slice(1)
      .flatMap((css) => [...css.matchAll(/#[0-9a-f]{3,8}\b|\b(?:oklch|rgba?|hsla?)\(|\b(?:white|black)\b(?!-)/gi)])
      .map((m) => m[0]);
    expect(raw).toEqual([]);
  });
});

/** WCAG 2 relative luminance of a tokens.css colour (plain hex or oklch). */
function luminance(color: string): number {
  const hex = cssColorToHex(color);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe.each(["light", "dark"] as const)("text contrast in the %s theme (WCAG AA, 4.5:1)", (theme) => {
  const light = declaredTokens(block(tokensCss, ":root"));
  const dark = declaredTokens(block(tokensCss, ':root[data-theme="dark"]'));
  const tokens = theme === "light" ? light : new Map([...light, ...dark]);
  const token = (name: string) => {
    const value = tokens.get(name);
    if (!value) throw new Error(`no ${name} in tokens.css`);
    return value;
  };

  // Every text token, on every surface it is written on.
  const pairs: [text: string, surfaces: string[]][] = [
    ["--color-ink", ["--color-page-bg", "--color-surface", "--color-surface-muted", "--color-sunken", "--color-field"]],
    ["--color-ink-soft", ["--color-page-bg", "--color-surface", "--color-surface-muted"]],
    ["--color-ink-muted", ["--color-page-bg", "--color-surface", "--color-surface-muted", "--color-sunken"]],
    // The model credit and the guess input's placeholder.
    ["--color-ink-faint", ["--color-page-bg", "--color-surface", "--color-field"]],
    ["--color-error", ["--color-page-bg", "--color-surface"]],
    ["--color-link", ["--color-page-bg", "--color-surface"]],
    ["--accent-deep", ["--color-surface", "--color-sunken"]],
    ["--color-on-ink", ["--color-solid", "--color-solid-raised"]],
    ["--color-on-ink-soft", ["--color-solid"]],
    ["--color-on-ink-muted", ["--color-solid"]],
    ["--color-on-ink-accent", ["--color-solid"]],
    ["--color-on-ink-error", ["--color-solid"]],
    ["--color-on-bright", ["--accent-solid"]],
    ["--proximity-hot-ink", ["--proximity-hot-bg"]],
    ["--proximity-warm-ink", ["--proximity-warm-bg"]],
    ["--proximity-cold-ink", ["--proximity-cold-bg"]],
  ];
  const cases = pairs.flatMap(([text, surfaces]) => surfaces.map((surface) => [text, surface] as const));

  it.each(cases)("%s on %s", (text, surface) => {
    expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(4.5);
  });
});

/** A text colour written at this opacity over a surface, as the hex colour it blends to. */
function blend(text: string, surface: string, opacity: number): string {
  const channels = (color: string) =>
    [1, 3, 5].map((i) => parseInt(cssColorToHex(color).slice(i, i + 2), 16));
  const [over, under] = [channels(text), channels(surface)];
  return `#${over
    .map((c, i) => Math.round(c * opacity + (under[i] ?? 0) * (1 - opacity)))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

describe.each(["light", "dark"] as const)("a close guess in the %s theme", (theme) => {
  const light = declaredTokens(block(tokensCss, ":root"));
  const dark = declaredTokens(block(tokensCss, ':root[data-theme="dark"]'));
  const tokens = theme === "light" ? light : new Map([...light, ...dark]);
  const text = tokens.get("--color-on-bright") ?? "";
  const bar = tokens.get("--accent-solid") ?? "";

  // Fainter than 4.5:1 below a score of about 75, on purpose: its opacity is
  // the score (decided with the developer). Never below WCAG's 3:1 floor.
  it("stays readable at its faintest, the opacity of a guess scored NEAR_SCORE", () => {
    expect(contrast(blend(text, bar, NEAR_MIN_OPACITY), bar)).toBeGreaterThanOrEqual(3);
  });

  it("can't be any fainter and stay readable", () => {
    expect(contrast(blend(text, bar, NEAR_MIN_OPACITY - 0.05), bar)).toBeLessThan(3);
  });
});

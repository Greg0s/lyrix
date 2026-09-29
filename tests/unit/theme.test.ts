// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cssColorToHex } from "../../scripts/lib/favicon";
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
    // Set inline by components, per element: a player's colour, a score's heat.
    const inline = new Set(["--player", "--heat", "--to-warm", "--to-hot"]);
    const undefinedTokens = [...used].filter((name) => !light.has(name) && !inline.has(name));
    expect(undefinedTokens).toEqual([]);
  });
});

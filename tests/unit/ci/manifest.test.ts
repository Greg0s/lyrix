import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PNG_ICONS, faviconColors } from "../../../scripts/lib/favicon";
import { ARCHIVES, HELP, parseRoute, routePath } from "../../../src/routes";

/**
 * The web app manifest (#79): what an installed Lyrix is called, which
 * icons it gets and how it opens. Nothing in the app reads it, and a browser
 * that dislikes it just stops offering to install, without a word: these
 * checks keep it valid and in step with index.html and tokens.css.
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const html = read("index.html").toString("utf8");
const colors = faviconColors(read("src/styles/tokens.css").toString("utf8"));

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lang: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
  shortcuts: { name: string; url: string }[];
}

const manifest = JSON.parse(read("public/manifest.webmanifest").toString("utf8")) as Manifest;

/** A `<meta>`'s content, by its `name`. */
function meta(name: string): string | undefined {
  return new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "s").exec(html)?.[1];
}

function pngSize(buf: Buffer): string {
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

describe("the web app manifest", () => {
  it("is linked from index.html", () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });

  it("names the app, in French, as index.html describes it", () => {
    expect(manifest).toMatchObject({ name: "Lyrix", short_name: "Lyrix", lang: "fr" });
    expect(manifest.description).toBe(meta("description"));
    // The name iOS puts under the home-screen icon.
    expect(meta("apple-mobile-web-app-title")).toBe(manifest.short_name);
  });

  it("opens today's song in a window of its own, the whole site in scope", () => {
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });
    expect(parseRoute(manifest.start_url).name).toBe("today");
    expect(meta("mobile-web-app-capable")).toBe("yes");
    expect(meta("apple-mobile-web-app-capable")).toBe("yes");
  });

  it("paints the splash screen and the window in the page's background, like theme-color", () => {
    expect(manifest.background_color).toBe(colors.pageBg);
    expect(manifest.theme_color).toBe(colors.pageBg);
    expect(meta("theme-color")).toBe(manifest.theme_color);
  });

  it("offers the 192 and 512 pixel icons installing requires, and a maskable one", () => {
    const icons = manifest.icons.map(({ sizes, purpose = "any" }) => `${sizes} ${purpose}`);
    expect(icons).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  });

  it.each(manifest.icons)("ships $src, generated with the favicon, at its announced size", (icon) => {
    expect(icon.src).toMatch(/^\/[\w-]+\.png$/);
    expect(icon.type).toBe("image/png");
    const file = icon.src.slice(1);
    expect(existsSync(new URL(`public/${file}`, root))).toBe(true);
    // Drawn by `npm run favicon:build` and checked for staleness by favicon.test.ts.
    const generated = PNG_ICONS.find((png) => png.file === file);
    expect(generated).toBeDefined();
    expect(icon.purpose === "maskable").toBe(generated?.maskable === true);
    expect(pngSize(read(`public/${file}`))).toBe(icon.sizes);
  });

  it("offers shortcuts to the archives and the rules, at the addresses the app answers", () => {
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual([routePath(ARCHIVES), routePath(HELP)]);
    for (const shortcut of manifest.shortcuts) {
      expect(parseRoute(shortcut.url).name).not.toBe("today");
      expect(shortcut.name).toBeTruthy();
    }
  });
});

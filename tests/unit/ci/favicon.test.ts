import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MASKABLE_SAFE_RADIUS,
  PNG_ICONS,
  PNG_SOURCE_KEYWORD,
  cssColorToHex,
  faviconColors,
  faviconSvg,
  pngIconFingerprint,
  pngText,
  withPngText,
} from "../../../scripts/lib/favicon";

/**
 * The favicon is generated from the logo mark and the palette
 * (`npm run favicon:build`), then committed. Nothing at runtime would notice
 * a missing file or one left stale after a palette change — the browser just
 * falls back to a generic icon — so these checks do.
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const html = read("index.html").toString("utf8");
const colors = faviconColors(read("src/styles/tokens.css").toString("utf8"));

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("favicon", () => {
  it("keeps the committed SVG in sync with the logo mark and tokens.css", () => {
    expect(read("public/favicon.svg").toString("utf8")).toBe(faviconSvg(colors, { rounded: true }));
  });

  it("draws with the mark's palette", () => {
    expect(colors).toEqual({ ink: "#221812", onInk: "#f7f1e7", accent: "#ec6a2c", pageBg: "#f7f1e7" });
  });

  it("links the SVG, the PNG fallback and the apple-touch-icon from index.html", () => {
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
    expect(html).toMatch(/<link rel="icon" href="\/favicon-48\.png" type="image\/png" sizes="48x48"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  });

  it.each(PNG_ICONS)("ships $file at $size×$size", ({ file, size }) => {
    expect(pngSize(read(`public/${file}`))).toEqual({ width: size, height: size });
  });

  it.each(PNG_ICONS)("keeps $file in sync with the logo mark and tokens.css", (icon) => {
    // Recorded by `npm run favicon:build` when it drew the file: run it again if this fails.
    expect(pngText(read(`public/${icon.file}`), PNG_SOURCE_KEYWORD)).toBe(pngIconFingerprint(colors, icon));
  });

  it("keeps the maskable icon's mark inside the safe zone, on a full-bleed background", () => {
    const svg = faviconSvg(colors, { rounded: false, maskable: true });
    const [background, ...pieces] = [...svg.matchAll(/<rect ([^>]*)\/>/g)].map(([, attrs]) =>
      Object.fromEntries([...attrs.matchAll(/(\w+)="([^"]*)"/g)].map(([, name, value]) => [name, value]))
    );
    expect(background).toMatchObject({ width: "36", height: "36" });
    expect(background).not.toHaveProperty("rx");
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) {
      const [x, y, width, height] = [piece.x, piece.y, piece.width, piece.height].map(Number);
      for (const [cx, cy] of [
        [x, y],
        [x + width, y],
        [x, y + height],
        [x + width, y + height],
      ]) {
        expect(Math.hypot(cx - 18, cy - 18)).toBeLessThanOrEqual(MASKABLE_SAFE_RADIUS * 36);
      }
    }
  });

  it("reads back the text it records in a PNG, leaving the image as it was", () => {
    const png = read("public/favicon-48.png");
    const signed = withPngText(png, "lyrix:test", "abc");
    expect(pngText(signed, "lyrix:test")).toBe("abc");
    expect(pngSize(signed)).toEqual(pngSize(png));
    expect(signed.subarray(-12).toString("latin1", 4, 8)).toBe("IEND");
    expect(pngText(signed, "lyrix:other")).toBeUndefined();
  });

  it("sets theme-color to the page background", () => {
    expect(html).toContain(`<meta name="theme-color" content="${colors.pageBg}" />`);
  });

  it("converts oklch tokens to sRGB hex", () => {
    expect(cssColorToHex("oklch(100% 0 0)")).toBe("#ffffff");
    expect(cssColorToHex("oklch(0% 0 0)")).toBe("#000000");
    expect(cssColorToHex("#EC6A2C")).toBe("#ec6a2c");
    expect(() => cssColorToHex("rgb(0 0 0)")).toThrow(/unsupported/);
  });
});

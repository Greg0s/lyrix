import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { invitePageHtml } from "../../../scripts/lib/invitePage";

/**
 * The web fonts are the site's own (src/styles/fonts.css). Fetched from
 * Google Fonts, as they once were, each visitor's IP address went to Google
 * without their consent, which the GDPR doesn't allow: a German court fined
 * a site for exactly that (LG München, 2022). Nothing else would catch them
 * coming back, since the page looks the same either way.
 */

const root = join(__dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const html = read("index.html");
const fontsCss = read("src/styles/fonts.css");
const tokensCss = read("src/styles/tokens.css");
const stylesheets = readdirSync(join(root, "src/styles")).map((name) => read(`src/styles/${name}`));

const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/;

/** Every file under `dir`, as a path relative to the repository. */
function filesUnder(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
  );
}

/** Each @font-face's family and file, the file relative to the repository (fonts.css is in src/styles). */
const faces = [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
  const url = /src:\s*url\("\.\.\/([^"]+)"\)/.exec(body)?.[1];
  return { body, family: /font-family:\s*"([^"]+)"/.exec(body)?.[1], file: url === undefined ? undefined : `src/${url}` };
});

describe("web fonts", () => {
  it("are never fetched from Google Fonts, by the page, the invite page, a stylesheet or the app", () => {
    expect(html).not.toMatch(GOOGLE_FONTS);
    expect(invitePageHtml(html)).not.toMatch(GOOGLE_FONTS);
    for (const sheet of stylesheets) expect(sheet).not.toMatch(GOOGLE_FONTS);
    const code = filesUnder("src").filter((path) => /\.(ts|tsx|css)$/.test(path));
    expect(code.filter((path) => GOOGLE_FONTS.test(read(path)))).toEqual([]);
  });

  it("have a face for every family the tokens name first", () => {
    const families = [...tokensCss.matchAll(/--font-[a-z]+:\s*"([^"]+)"/g)].map(([, family]) => family);
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) expect(faces.some((face) => face.family === family)).toBe(true);
  });

  it("are files of the repository, woff2, under their licence, and never hide the text while loading", () => {
    expect(faces.length).toBeGreaterThan(0);
    for (const { body, family, file } of faces) {
      expect(file).toMatch(/^src\/assets\/fonts\/[a-z-]+\.woff2$/);
      expect(existsSync(join(root, file ?? ""))).toBe(true);
      expect(body).toContain("font-display: swap");
      // The SIL Open Font License asks for its text to go with the fonts.
      const licence = join(root, "src/assets/fonts", `${family?.replace(/\s/g, "")}-OFL.txt`);
      expect(existsSync(licence)).toBe(true);
      expect(readFileSync(licence, "utf8")).toContain("SIL Open Font License, Version 1.1");
    }
  });

  it("are loaded before the app's own stylesheets", () => {
    const main = read("src/main.tsx");
    const imports = [...main.matchAll(/^import "\.\/styles\/([a-z]+)\.css";/gm)].map(([, name]) => name);
    expect(imports[0]).toBe("fonts");
  });

  it("start downloading with the HTML, and the download is the one the stylesheet uses", () => {
    const preloads = [...html.matchAll(/<link rel="preload"[^>]*>/g)].map(([tag]) => tag);
    expect(preloads.length).toBeGreaterThan(0);
    for (const tag of preloads) {
      const href = /href="\/([^"]+)"/.exec(tag)?.[1];
      expect(faces.map((face) => face.file)).toContain(href);
      expect(tag).toContain('as="font"');
      expect(tag).toContain('type="font/woff2"');
      // A font is always fetched in CORS mode: a preload without it is a second download.
      expect(tag).toMatch(/\scrossorigin(\s|\/|>)/);
    }
  });
});

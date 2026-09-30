import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PNG_ICONS, faviconColors, faviconSvg } from "./lib/favicon";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_FONTS, socialImageHtml } from "./lib/socialImage";

/**
 * Regenerates public/favicon.svg, its PNG fallbacks and the link-preview image
 * (public/og-image.png) from the logo mark's geometry and the palette in
 * tokens.css. Run after changing either;
 * tests/unit/ci/favicon.test.ts fails while the committed files are stale.
 *
 * PNGs are rasterized by the Chromium Playwright already uses for e2e, so no
 * image library is needed. Where that Chromium isn't the build the installed
 * @playwright/test expects (see docs/LEARNINGS.md), point
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE at the one available.
 */
const root = new URL("../", import.meta.url);
const tokens = readFileSync(new URL("src/styles/tokens.css", root), "utf8");
const colors = faviconColors(tokens);

writeFileSync(new URL("public/favicon.svg", root), faviconSvg(colors, { rounded: true }));
console.log("wrote public/favicon.svg");

/**
 * The web fonts, fetched here and inlined as data: URLs. Chromium's own
 * requests don't go through every network setup Node's do (a cloud session's
 * proxy among them), and a font that silently fails to load would draw the
 * wordmark in a fallback face.
 */
async function inlinedFontCss(): Promise<string> {
  // Google Fonts picks the file format from the user agent; any modern one gets woff2.
  const headers = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36" };
  const response = await fetch(SOCIAL_IMAGE_FONTS, { headers });
  if (!response.ok) throw new Error(`fetching ${SOCIAL_IMAGE_FONTS}: HTTP ${response.status}`);
  let css = await response.text();
  for (const [, url] of css.matchAll(/url\((https:[^)]+)\)/g)) {
    const font = await fetch(url);
    if (!font.ok) throw new Error(`fetching ${url}: HTTP ${font.status}`);
    const type = font.headers.get("content-type") ?? "font/woff2";
    css = css.replace(url, `data:${type};base64,${Buffer.from(await font.arrayBuffer()).toString("base64")}`);
  }
  return css;
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
});
try {
  for (const icon of PNG_ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    const svg = faviconSvg(colors, { rounded: icon.rounded }).replace(
      "<svg ",
      `<svg width="${icon.size}" height="${icon.size}" `
    );
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.screenshot({
      path: fileURLToPath(new URL(`public/${icon.file}`, root)),
      omitBackground: true,
      clip: { x: 0, y: 0, width: icon.size, height: icon.size },
    });
    await page.close();
    console.log(`wrote public/${icon.file}`);
  }

  const page = await browser.newPage({ viewport: { width: SOCIAL_IMAGE.width, height: SOCIAL_IMAGE.height } });
  await page.setContent(socialImageHtml(colors, await inlinedFontCss()));
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('800 150px "Bricolage Grotesque"') && document.fonts.check('500 44px "Figtree"');
  });
  if (!loaded) throw new Error("the social image's web fonts did not load");
  await page.screenshot({ path: fileURLToPath(new URL(`public/${SOCIAL_IMAGE.file}`, root)) });
  await page.close();
  console.log(`wrote public/${SOCIAL_IMAGE.file}`);
} finally {
  await browser.close();
}

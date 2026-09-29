import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PNG_ICONS, faviconColors, faviconSvg } from "./lib/favicon";

/**
 * Regenerates public/favicon.svg and its PNG fallbacks from the logo mark's
 * geometry and the palette in tokens.css. Run after changing either;
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
} finally {
  await browser.close();
}

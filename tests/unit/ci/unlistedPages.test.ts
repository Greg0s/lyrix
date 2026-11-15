import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOINDEX, UNLISTED_PAGES, unlistedPageFile, unlistedPageHeading, unlistedPageHtml, unlistedPageUrl } from "../../../scripts/lib/unlistedPages";
import { ARCHIVES, LEGAL, routePath, routeTitle } from "../../../src/routes";

/**
 * The legal notice's and the archives' pages: index.html under their own
 * title, description and canonical link, kept out of search results. Served
 * as index.html itself, they were copies of the home page to Google, and the
 * legal notice came first on a search for "Lyrix jeu" (docs/LEARNINGS.md,
 * 2026-11-13).
 */

const SITE = "https://lyrix.mintymoon.app/";

const root = new URL("../../../", import.meta.url);
const indexHtml = readFileSync(new URL("index.html", root), "utf8");

function meta(page: string, key: string): string | undefined {
  return new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`, "s").exec(page)?.[1];
}

describe("the pages kept out of search results", () => {
  it("are the legal notice and the archives", () => {
    expect(UNLISTED_PAGES.map((page) => page.route)).toEqual([LEGAL, ARCHIVES]);
    expect(UNLISTED_PAGES.map(unlistedPageFile)).toEqual(["mentions-legales.html", "archives.html"]);
  });

  for (const page of UNLISTED_PAGES) {
    const path = routePath(page.route);
    const html = unlistedPageHtml(indexHtml, page);

    describe(path, () => {
      it("is canonical at its own address, never the home page's", () => {
        expect(unlistedPageUrl(page)).toBe(`${SITE}${path.slice(1)}`);
        expect(html.match(/<link rel="canonical"[^>]*>/g)).toEqual([`<link rel="canonical" href="${unlistedPageUrl(page)}" />`]);
        expect(meta(html, "og:url")).toBe(unlistedPageUrl(page));
      });

      it("asks search engines to leave it out, and to follow its links", () => {
        expect(meta(html, "robots")).toBe(NOINDEX);
        expect(NOINDEX).toBe("noindex, follow");
      });

      it("is titled as the tab names it once the app runs, and described as itself", () => {
        expect(html.match(/<title>[^<]*<\/title>/g)).toEqual([`<title>${routeTitle(page.route)}</title>`]);
        expect(meta(html, "og:title")).toBe(routeTitle(page.route));
        expect(meta(html, "description")).toBe(page.description);
        expect(meta(html, "og:description")).toBe(page.description);
        expect(page.description.length).toBeLessThanOrEqual(160);
      });

      it("says what it is before the app runs, without the home page's structured data", () => {
        expect(unlistedPageHeading(page)).not.toMatch(/Lyrix$/);
        expect(html).toContain(`<h1 class="lyrix-static-title">${unlistedPageHeading(page)}</h1>`);
        expect(html).toContain(page.lead);
        expect(html).not.toContain("application/ld+json");
        expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
      });
    });
  }

  it("leaves the home page listed", () => {
    expect(indexHtml).not.toContain('name="robots"');
    expect(indexHtml).toContain(`<link rel="canonical" href="${SITE}" />`);
  });

  // A day of the archives has no file of its own: the SPA fallback answers it
  // with index.html, so the noindex goes in a header.
  it("keeps a day of the archives out with a header", () => {
    const headers = readFileSync(new URL("public/_headers", root), "utf8");
    expect(headers).toMatch(/^\/archives\/\*\r?\n {2}X-Robots-Tag: noindex\r?$/m);
  });
});

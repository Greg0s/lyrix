import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOCIAL_IMAGE } from "../../../scripts/lib/socialImage";

/**
 * Search-result and link-preview metadata: nothing in the app reads it, so a
 * typo in a URL or a JSON-LD block that no longer parses would only show up as
 * a bare link in a chat or a plain result in Google, long after deploying.
 */

const SITE = "https://lyrix-eyg.pages.dev/";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const html = read("index.html").toString("utf8");

/** A `<meta>`'s content, by its `name` or `property`. */
function meta(key: string): string | undefined {
  const tag = new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`, "s").exec(html);
  return tag?.[1];
}

interface JsonLdNode {
  "@type": string | string[];
  "@id"?: string;
  [key: string]: unknown;
}

function jsonLd(): JsonLdNode[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  expect(blocks).toHaveLength(1);
  const data = JSON.parse(blocks[0][1]) as { "@context": string; "@graph": JsonLdNode[] };
  expect(data["@context"]).toBe("https://schema.org");
  return data["@graph"];
}

const nodeOfType = (type: string) =>
  jsonLd().find((node) => ([] as string[]).concat(node["@type"]).includes(type));

describe("rich snippets", () => {
  it("describes the page for search results", () => {
    expect(html).toMatch(/<title>Lyrix[^<]+<\/title>/);
    expect(meta("description")?.length).toBeGreaterThan(50);
    // Google cuts descriptions around 160 characters.
    expect(meta("description")?.length).toBeLessThanOrEqual(160);
    expect(html).toContain(`<link rel="canonical" href="${SITE}" />`);
  });

  it("gives link previews a title, a description and a large image", () => {
    expect(meta("og:url")).toBe(SITE);
    expect(meta("og:title")).toBeTruthy();
    expect(meta("og:description")).toBeTruthy();
    expect(meta("og:locale")).toBe("fr_FR");
    expect(meta("og:image")).toBe(`${SITE}${SOCIAL_IMAGE.file}`);
    expect(meta("og:image:width")).toBe(String(SOCIAL_IMAGE.width));
    expect(meta("og:image:height")).toBe(String(SOCIAL_IMAGE.height));
    expect(meta("og:image:alt")).toBeTruthy();
    expect(meta("twitter:card")).toBe("summary_large_image");
  });

  it("ships the preview image at the size index.html announces", () => {
    const png = read(`public/${SOCIAL_IMAGE.file}`);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({
      width: SOCIAL_IMAGE.width,
      height: SOCIAL_IMAGE.height,
    });
  });

  it("names the site in structured data", () => {
    const site = nodeOfType("WebSite");
    expect(site).toMatchObject({ name: "Lyrix", url: SITE, inLanguage: "fr" });
  });

  it("describes the game as free to play, with no invented rating", () => {
    const game = nodeOfType("VideoGame");
    expect(game).toMatchObject({
      name: "Lyrix",
      url: SITE,
      image: meta("og:image"),
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0" },
      isPartOf: { "@id": nodeOfType("WebSite")?.["@id"] },
    });
    expect(game).not.toHaveProperty("aggregateRating");
    expect(game).not.toHaveProperty("review");
  });

  it("points every absolute URL at the production site", () => {
    const urls = [...html.matchAll(/https:\/\/lyrix[^"\s]*/g)].map((m) => m[0]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith(SITE)).toBe(true);
  });

  it("lets crawlers in and hands them the sitemap", () => {
    const robots = read("public/robots.txt").toString("utf8");
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
    expect(robots).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(read("public/sitemap.xml").toString("utf8")).toContain(`<loc>${SITE}</loc>`);
  });
});

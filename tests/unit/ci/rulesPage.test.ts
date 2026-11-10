import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { build } from "vite";
import { RULES_PAGE, rulesPageHtml } from "../../../scripts/lib/rulesPage";
import { FAQ, RULES_DESCRIPTION, RULES_TITLE } from "../../../src/rules";
import { HELP, routePath, routeTitle } from "../../../src/routes";

/**
 * The rules' page (`/comment-jouer`): index.html under the rules' own title,
 * description, canonical link and FAQ. Served by the SPA fallback, the rules
 * had the home page's canonical link, and search engines took them for a
 * copy of it.
 */

const SITE = "https://lyrix.mintymoon.app/";

const root = new URL("../../../", import.meta.url);
const indexHtml = readFileSync(new URL("index.html", root), "utf8");
const html = rulesPageHtml(indexHtml);

function meta(page: string, key: string): string | undefined {
  return new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`, "s").exec(page)?.[1];
}

interface JsonLdNode {
  "@type": string;
  [key: string]: unknown;
}

function jsonLd(page: string): JsonLdNode[] {
  const blocks = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  expect(blocks).toHaveLength(1);
  const data = JSON.parse(blocks[0][1]) as { "@context": string; "@graph": JsonLdNode[] };
  expect(data["@context"]).toBe("https://schema.org");
  return data["@graph"];
}

describe("the rules' page", () => {
  it("is at the rules' address, and canonical there", () => {
    expect(RULES_PAGE.url).toBe(`${SITE}${routePath(HELP).slice(1)}`);
    expect(html).toContain(`<link rel="canonical" href="${RULES_PAGE.url}" />`);
    expect(meta(html, "og:url")).toBe(RULES_PAGE.url);
    expect(html).not.toContain('name="robots"');
  });

  it("is titled and described as the rules, as the tab names them once the app runs", () => {
    expect(html).toContain(`<title>${RULES_TITLE}</title>`);
    expect(routeTitle(HELP)).toBe(RULES_TITLE);
    expect(meta(html, "description")).toBe(RULES_DESCRIPTION);
    // Google cuts descriptions around 160 characters.
    expect(RULES_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(meta(html, "og:title")).toBe(RULES_TITLE);
    expect(meta(html, "og:description")).toBe(RULES_DESCRIPTION);
  });

  it("holds every question the page answers, as structured data tied to the game", () => {
    const [faq] = jsonLd(html);
    expect(faq).toMatchObject({
      "@type": "FAQPage",
      url: RULES_PAGE.url,
      inLanguage: "fr",
      isPartOf: { "@id": `${SITE}#website` },
      about: { "@id": `${SITE}#game` },
      mainEntity: FAQ.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    });
    // The ids it points to are the home page's.
    expect(indexHtml).toContain(`"@id": "${SITE}#website"`);
    expect(indexHtml).toContain(`"@id": "${SITE}#game"`);
  });

  it("is otherwise the game itself: script, theme boot, fonts and link preview image", () => {
    for (const piece of ['<script type="module" src="/src/main.tsx">', 'id="lyrix-theme-boot"', 'rel="preload" href="/src/assets/fonts/']) {
      expect(html).toContain(piece);
    }
    expect(meta(html, "og:image")).toBe(meta(indexHtml, "og:image"));
  });

  it("points every absolute URL at the production site", () => {
    for (const [url] of html.matchAll(/https:\/\/lyrix[^"\s]*/g)) expect(url.startsWith(SITE)).toBe(true);
  });

  it("fails loudly when index.html no longer has a tag it rewrites", () => {
    expect(() => rulesPageHtml(indexHtml.replace(/<link rel="canonical"[^>]*>/, ""))).toThrow(/canonical/);
  });

  it("is emitted by the build, from the built index.html", async () => {
    const result = await build({ root: fileURLToPath(root), logLevel: "silent", build: { write: false } });
    // One output for one build config; a watcher only with build.watch.
    if (Array.isArray(result) || !("output" in result)) throw new Error("expected a single, unwatched build");
    const files = new Map(result.output.map((file) => [file.fileName, file]));
    const built = files.get("index.html");
    const rules = files.get(RULES_PAGE.file);
    expect(built?.type).toBe("asset");
    expect(rules?.type).toBe("asset");
    if (built?.type !== "asset" || rules?.type !== "asset") return;
    expect(rules.source).toBe(rulesPageHtml(String(built.source)));
    expect(String(rules.source)).toMatch(/<script type="module" crossorigin src="\/assets\/[^"]+\.js">/);
  }, 60_000);
});

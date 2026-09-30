import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { build } from "vite";
import { INVITE_PAGE, invitePageHtml } from "../../../scripts/lib/invitePage";
import { INVITE_IMAGE } from "../../../scripts/lib/socialImage";
import { INVITE_PATH } from "../../../src/game/room";

/**
 * The invite page (`/salon/<code>`): index.html under an invitation's link
 * preview. Like rich snippets, nothing in the app reads it — a stale rule or
 * a dropped tag would only show as a bare link in a chat.
 */

const SITE = "https://lyrix-eyg.pages.dev/";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const indexHtml = read("index.html").toString("utf8");
const html = invitePageHtml(indexHtml);

function meta(page: string, key: string): string | undefined {
  return new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`, "s").exec(page)?.[1];
}

describe("the invite page", () => {
  it("previews as an invitation, with its own large image", () => {
    expect(meta(html, "og:title")).toBe(INVITE_PAGE.title);
    expect(meta(html, "og:description")).toBe(INVITE_PAGE.description);
    expect(meta(html, "og:url")).toBe(`${SITE}salon/`);
    expect(meta(html, "og:image")).toBe(`${SITE}${INVITE_IMAGE.file}`);
    expect(meta(html, "og:image:width")).toBe(String(INVITE_IMAGE.width));
    expect(meta(html, "og:image:height")).toBe(String(INVITE_IMAGE.height));
    expect(meta(html, "og:image:alt")).toBe(INVITE_PAGE.imageAlt);
    expect(meta(html, "twitter:card")).toBe("summary_large_image");
  });

  it("is otherwise the game itself: same title, script, theme boot and fonts", () => {
    expect(html.match(/<title>.*<\/title>/)?.[0]).toBe(indexHtml.match(/<title>.*<\/title>/)?.[0]);
    for (const piece of ['<script type="module" src="/src/main.tsx">', 'id="lyrix-theme-boot"', "fonts.googleapis.com/css2"]) {
      expect(html).toContain(piece);
    }
  });

  it("stays out of search results, and leaves structured data to the home page", () => {
    expect(meta(html, "robots")).toBe("noindex");
    expect(html).toContain(`<link rel="canonical" href="${SITE}" />`);
    expect(html).not.toContain("application/ld+json");
  });

  it("points every absolute URL at the production site", () => {
    for (const [url] of html.matchAll(/https:\/\/lyrix[^"\s]*/g)) expect(url.startsWith(SITE)).toBe(true);
  });

  it("fails loudly when index.html no longer has a tag it rewrites", () => {
    expect(() => invitePageHtml(indexHtml.replace(/<meta property="og:title"[^>]*>/, ""))).toThrow(/og:title/);
  });

  it("ships the preview image at the size it announces", () => {
    const png = read(`public/${INVITE_IMAGE.file}`);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({
      width: INVITE_IMAGE.width,
      height: INVITE_IMAGE.height,
    });
  });

  it("is what Cloudflare Pages answers every invite link with", () => {
    const rules = read("public/_redirects")
      .toString("utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => line.trim().split(/\s+/));
    expect(rules).toContainEqual([`${INVITE_PATH}:code`, `/${INVITE_PAGE.file.replace(/index\.html$/, "")}`, "200"]);
  });

  it("is emitted by the build, from the built index.html", async () => {
    const result = await build({ root: fileURLToPath(root), logLevel: "silent", build: { write: false } });
    // One output for one build config; a watcher only with build.watch.
    if (Array.isArray(result) || !("output" in result)) throw new Error("expected a single, unwatched build");
    const files = new Map(result.output.map((file) => [file.fileName, file]));
    const built = files.get("index.html");
    const invite = files.get(INVITE_PAGE.file);
    expect(built?.type).toBe("asset");
    expect(invite?.type).toBe("asset");
    if (built?.type !== "asset" || invite?.type !== "asset") return;
    expect(invite.source).toBe(invitePageHtml(String(built.source)));
    // The built page loads the bundled app, by absolute path so it works under /salon/.
    expect(String(invite.source)).toMatch(/<script type="module" crossorigin src="\/assets\/[^"]+\.js">/);
  }, 60_000);
});

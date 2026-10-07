import { describe, expect, it } from "vitest";
import { inviteUrl } from "../../../src/game/room";
import { strategyFor, type RequestShape } from "../../../src/serviceWorker/routes";

/**
 * Which requests the service worker answers, and how (#79). What it must
 * never do is answer the API, whose rounds, guesses and rooms only the
 * Worker may give, or an invite link, whose page Pages serves.
 */

const SITE = "https://lyrix-eyg.pages.dev";
const PRECACHED = new Set(["/", "/assets/index-abc123.js", "/assets/index-def456.css", "/icon-192.png"]);

function strategy(url: string, { method = "GET", mode = "cors" }: Partial<RequestShape> = {}) {
  return strategyFor({ url: new URL(url, SITE).toString(), method, mode }, SITE, PRECACHED);
}

const navigate = { mode: "navigate" } as const;

describe("the service worker's routes", () => {
  it.each([
    "/api/round",
    "/api/round?day=2026-10-01",
    "/api/round/resume",
    "/api/guess",
    "/api/rooms/ABCDEF/ws",
    "/api",
  ])("never answers the API on the site's own origin: %s", (path) => {
    expect(strategy(path)).toBe("network");
    expect(strategy(path, navigate)).toBe("network");
  });

  it("never answers the API on its own origin, as in production", () => {
    expect(strategy("https://lyrix-api.lyrix.workers.dev/api/round")).toBe("network");
    expect(strategy("https://lyrix-api.lyrix.workers.dev/api/round?day=2026-10-01")).toBe("network");
  });

  it("leaves invite links to the invite page Pages serves", () => {
    expect(strategy(inviteUrl("ABCDEF", SITE), navigate)).toBe("network");
    expect(strategy("/salon/", navigate)).toBe("network");
    expect(strategy("/salon", navigate)).toBe("network");
  });

  it("answers every other address of the app as a page, the network first", () => {
    for (const path of ["/", "/archives", "/archives/2026-10-01", "/comment-jouer", "/?utm_source=x", "/salons", "/apifoo"]) {
      expect(strategy(path, navigate), path).toBe("page");
    }
  });

  it("serves this build's files from the cache, and nothing else", () => {
    expect(strategy("/assets/index-abc123.js")).toBe("precached");
    expect(strategy("/assets/index-def456.css")).toBe("precached");
    expect(strategy("/icon-192.png")).toBe("precached");
    // Another build's file, a file the shell doesn't use, or a precached path with a query.
    expect(strategy("/assets/index-old000.js")).toBe("network");
    expect(strategy("/og-image.png")).toBe("network");
    expect(strategy("/assets/index-abc123.js?v=2")).toBe("network");
  });

  it("only ever answers GET requests", () => {
    for (const method of ["POST", "PUT", "DELETE", "HEAD"]) {
      expect(strategy("/assets/index-abc123.js", { method })).toBe("network");
      expect(strategy("/", { method, mode: "navigate" })).toBe("network");
    }
  });

  it("keeps the web fonts, and no other origin's files", () => {
    expect(strategy("https://fonts.googleapis.com/css2?family=Figtree:wght@400&display=swap", { mode: "no-cors" })).toBe(
      "font-stylesheet"
    );
    expect(strategy("https://fonts.gstatic.com/s/figtree/v5/abc.woff2")).toBe("font-file");
    expect(strategy("https://lrclib.net/api/search?q=x")).toBe("network");
    expect(strategy("https://example.com/assets/index-abc123.js")).toBe("network");
  });
});

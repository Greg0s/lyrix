import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCHIVES, HELP, HOME_TITLE, isPageRoute, LEGAL, parseRoute, routePath, routeTitle, TODAY } from "../../src/routes";

const NOW = new Date("2026-10-20T10:00:00Z");

describe("parseRoute", () => {
  it("reads today's song, the archives and a day of them", () => {
    expect(parseRoute("/", NOW)).toEqual(TODAY);
    expect(parseRoute("/archives", NOW)).toEqual(ARCHIVES);
    expect(parseRoute("/archives/", NOW)).toEqual(ARCHIVES);
    expect(parseRoute("/archives/2026-10-15", NOW)).toEqual({ name: "day", day: "2026-10-15" });
  });

  it("reads the rules' page", () => {
    expect(parseRoute("/comment-jouer", NOW)).toEqual(HELP);
    expect(parseRoute("/comment-jouer/", NOW)).toEqual(HELP);
    expect(parseRoute("/comment-jouerxyz", NOW)).toEqual(TODAY);
  });

  it("reads the legal notice's page", () => {
    expect(parseRoute("/mentions-legales", NOW)).toEqual(LEGAL);
    expect(parseRoute("/mentions-legales/", NOW)).toEqual(LEGAL);
    expect(parseRoute("/mentions-legalesxyz", NOW)).toEqual(TODAY);
  });

  it("takes today's own day for today's song", () => {
    expect(parseRoute("/archives/2026-10-20", NOW)).toEqual(TODAY);
  });

  it("sends a day the archives don't offer to the archives", () => {
    for (const path of ["/archives/2026-10-21", "/archives/2026-09-30", "/archives/2026-02-30", "/archives/hier"]) {
      expect(parseRoute(path, NOW), path).toEqual(ARCHIVES);
    }
  });

  it("leaves any other path to today's song, an invite link included", () => {
    expect(parseRoute("/salon/ABC234", NOW)).toEqual(TODAY);
    expect(parseRoute("/archivesxyz", NOW)).toEqual(TODAY);
  });
});

describe("routePath", () => {
  it("round-trips with parseRoute", () => {
    for (const route of [TODAY, ARCHIVES, HELP, LEGAL, { name: "day" as const, day: "2026-10-15" }]) {
      expect(parseRoute(routePath(route), NOW)).toEqual(route);
    }
  });
});

describe("isPageRoute", () => {
  it("tells the pages shown over a round from the rounds themselves", () => {
    expect(isPageRoute(ARCHIVES)).toBe(true);
    expect(isPageRoute(HELP)).toBe(true);
    expect(isPageRoute(LEGAL)).toBe(true);
    expect(isPageRoute(TODAY)).toBe(false);
    expect(isPageRoute({ name: "day", day: "2026-10-15" })).toBe(false);
  });
});

describe("routeTitle", () => {
  it("is index.html's own title for today's song", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain(`<title>${HOME_TITLE}</title>`);
    expect(routeTitle(TODAY)).toBe(HOME_TITLE);
  });

  it("names every other screen, a day by its date alone", () => {
    expect(routeTitle(ARCHIVES)).toMatch(/^Archives.* - Lyrix$/);
    expect(routeTitle({ name: "day", day: "2026-10-01" })).toBe("Chanson du jeudi 1er octobre - Lyrix");
    expect(routeTitle(HELP)).toMatch(/Lyrix/);
    expect(routeTitle(LEGAL)).toMatch(/^Mentions légales.* - Lyrix$/);
  });
});

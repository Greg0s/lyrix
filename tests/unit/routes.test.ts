import { describe, expect, it } from "vitest";
import { ARCHIVES, parseRoute, routePath, TODAY } from "../../src/routes";

const NOW = new Date("2026-10-01T10:00:00Z");

describe("parseRoute", () => {
  it("reads today's song, the archives and a day of them", () => {
    expect(parseRoute("/", NOW)).toEqual(TODAY);
    expect(parseRoute("/archives", NOW)).toEqual(ARCHIVES);
    expect(parseRoute("/archives/", NOW)).toEqual(ARCHIVES);
    expect(parseRoute("/archives/2026-09-26", NOW)).toEqual({ name: "day", day: "2026-09-26" });
  });

  it("takes today's own day for today's song", () => {
    expect(parseRoute("/archives/2026-10-01", NOW)).toEqual(TODAY);
  });

  it("sends a day the archives don't offer to the archives", () => {
    for (const path of ["/archives/2026-10-02", "/archives/2026-09-11", "/archives/2026-02-30", "/archives/hier"]) {
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
    for (const route of [TODAY, ARCHIVES, { name: "day" as const, day: "2026-09-26" }]) {
      expect(parseRoute(routePath(route), NOW)).toEqual(route);
    }
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noViews, type VisitReport } from "../../src/game/visit";
import { ARCHIVES, HELP, TODAY } from "../../src/routes";
import {
  browserRefusesTracking,
  countView,
  firstReport,
  flushVisit,
  isStatsOptedOut,
  resetVisit,
  setStatsOptedOut,
  startVisit,
  statsAllowed,
  takeReport,
} from "../../src/stats";

const SITE = "https://lyrix.test";

function at(path: string): Location {
  return new URL(path, SITE) as unknown as Location;
}

let beacons: { url: string; body: VisitReport }[];

beforeEach(() => {
  localStorage.clear();
  resetVisit();
  beacons = [];
  vi.stubGlobal("navigator", {
    ...navigator,
    doNotTrack: null,
    sendBeacon: (url: string, body: string) => {
      beacons.push({ url, body: JSON.parse(body) as VisitReport });
      return true;
    },
  });
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetVisit();
});

function hide(): void {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
}

describe("a visit's first report", () => {
  it("names the screen it landed on and counts it, with where it came from", () => {
    expect(firstReport(at("/archives?utm_source=Mastodon&utm_medium=social&utm_campaign=lancement"), "https://www.reddit.com/r/france/", false)).toEqual({
      landed: true,
      entry: "archives",
      referrer: "www.reddit.com",
      source: "mastodon",
      medium: "social",
      campaign: "lancement",
      display: "browser",
      views: { ...noViews(), archives: 1 },
    });
  });

  it("says an invite link without its code, and an installed app", () => {
    const report = firstReport(at("/salon/ABC234"), "", true);
    expect(report).toMatchObject({ entry: "invite", display: "app", views: { ...noViews(), today: 1 } });
    expect(JSON.stringify(report)).not.toContain("ABC234");
  });

  it("keeps a referrer's host alone, never its path, and none from the site itself", () => {
    expect(firstReport(at("/"), "https://news.ycombinator.com/item?id=1", false).referrer).toBe("news.ycombinator.com");
    expect(firstReport(at("/"), `${SITE}/archives`, false).referrer).toBe("");
    expect(firstReport(at("/"), "not a url", false).referrer).toBe("");
  });

  it("takes ?ref= for a source when a link has no utm_source", () => {
    expect(firstReport(at("/?ref=Discord"), "", false).source).toBe("discord");
  });
});

describe("the reports of one page load", () => {
  it("are sent on hiding the tab, to the Worker: the first lands the visit, the next only add screens", () => {
    startVisit();
    countView(ARCHIVES);
    countView(TODAY);
    hide();
    countView(HELP);
    hide();
    // Nothing new: nothing sent.
    hide();

    expect(beacons.map((beacon) => new URL(beacon.url).pathname)).toEqual(["/api/visit", "/api/visit"]);
    expect(beacons[0].body).toMatchObject({ landed: true, entry: "today", views: { ...noViews(), today: 2, archives: 1 } });
    expect(beacons[1].body).toMatchObject({ landed: false, entry: "today", views: { ...noViews(), help: 1 } });
  });

  it("are dropped, never sent later, while the player opposes it", () => {
    startVisit();
    setStatsOptedOut(true);
    hide();
    setStatsOptedOut(false);
    hide();
    expect(beacons).toEqual([]);
  });

  it("aren't sent at all from a browser that asks not to be tracked", () => {
    for (const signals of [{ doNotTrack: "1" }, { globalPrivacyControl: true }]) {
      resetVisit();
      vi.stubGlobal("navigator", { ...navigator, ...signals });
      expect(browserRefusesTracking()).toBe(true);
      expect(statsAllowed()).toBe(false);
      startVisit();
      hide();
    }
    expect(beacons).toEqual([]);
  });

  it("fall back on a keepalive fetch where sendBeacon refuses", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { ...navigator, doNotTrack: null, sendBeacon: () => false });
    startVisit();
    flushVisit();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]).toMatchObject([expect.stringMatching(/\/api\/visit$/), { method: "POST", keepalive: true }]);
  });

  it("have nothing to report before the visit starts", () => {
    countView(ARCHIVES);
    expect(takeReport()).toBeNull();
  });
});

describe("the player's opposition", () => {
  it("is kept on the device, and lifted", () => {
    expect(isStatsOptedOut()).toBe(false);
    setStatsOptedOut(true);
    expect(localStorage.getItem("lyrix:no-stats")).toBe("1");
    expect(statsAllowed()).toBe(false);
    setStatsOptedOut(false);
    expect(localStorage.getItem("lyrix:no-stats")).toBeNull();
    expect(statsAllowed()).toBe(true);
  });

  it("holds for the page even where storage refuses to keep it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setStatsOptedOut(true);
    expect(statsAllowed()).toBe(false);
    vi.restoreAllMocks();
  });
});

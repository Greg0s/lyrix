import { describe, expect, it } from "vitest";
import { cleanCampaign, cleanHost, MAX_VIEWS_PER_PAGE, noViews, parseVisitReport } from "../../../src/game/visit";

const report = {
  landed: true,
  entry: "today",
  referrer: "news.ycombinator.com",
  source: "mastodon",
  medium: "social",
  campaign: "lancement",
  display: "browser",
  views: { today: 1, archives: 2 },
};

describe("a visit report, as the Worker reads it", () => {
  it("keeps every field it knows, and counts the screens it wasn't told about as unseen", () => {
    expect(parseVisitReport(report)).toEqual({ ...report, views: { ...noViews(), today: 1, archives: 2 } });
  });

  it("refuses anything that isn't a report", () => {
    for (const body of [null, "visit", 42, [], {}, { ...report, landed: "yes" }, { ...report, entry: "salon/ABC234" }]) {
      expect(parseVisitReport(body)).toBeNull();
    }
  });

  it("keeps nothing it doesn't count: a host alone, short campaign names, bounded view counts", () => {
    const parsed = parseVisitReport({
      ...report,
      referrer: "https://example.com/page?user=42",
      source: "Newsletter Octobre!! <script>",
      medium: "x".repeat(200),
      display: "something",
      views: { today: 1e9, day: -3, help: 2.7, legal: "5", stray: 4 },
      extra: "dropped",
    });
    expect(parsed).toEqual({
      ...report,
      referrer: "",
      source: "newsletter-octobre-script",
      medium: "x".repeat(40),
      display: "browser",
      views: { today: MAX_VIEWS_PER_PAGE, day: 0, archives: 0, help: 2, legal: 0 },
    });
  });

  it("takes a host in any case, and nothing that isn't one", () => {
    expect(cleanHost("WWW.Google.FR")).toBe("www.google.fr");
    for (const host of ["", "localhost", "a b.fr", "evil.com/path", 12, null, `${"a".repeat(100)}.fr`]) {
      expect(cleanHost(host)).toBe("");
    }
  });

  it("writes campaign names the same way however a link spelled them", () => {
    expect(cleanCampaign(" Reddit_FR ")).toBe("reddit_fr");
    expect(cleanCampaign("été 2026")).toBe("t-2026");
    expect(cleanCampaign(undefined)).toBe("");
  });
});

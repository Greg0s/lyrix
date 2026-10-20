import { describe, expect, it, vi } from "vitest";
import { EVENT_FIELDS } from "../../../worker/src/events";
import { daysFromArgs, formatTable, runQuery, statsConfig, statsQueries } from "../../../scripts/lib/stats";

const config = { accountId: "acc123", apiToken: "tok" };

describe("npm run stats", () => {
  it("names every variable it is missing, and where to get it", () => {
    expect(() => statsConfig({})).toThrow(/CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are not set[\s\S]*Account Analytics > Read/);
    expect(() => statsConfig({ CLOUDFLARE_ACCOUNT_ID: "acc" })).toThrow(/^stats: CLOUDFLARE_API_TOKEN is not set/);
    expect(statsConfig({ CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "tok" })).toEqual({ accountId: "acc", apiToken: "tok" });
  });

  it("reads every event the Worker writes, over the days asked, counting sampled rows by their weight", () => {
    const queries = statsQueries(30);
    for (const event of Object.keys(EVENT_FIELDS)) {
      expect(queries.some(({ sql }) => sql.includes(`'${event}'`)), event).toBe(true);
    }
    for (const { sql } of queries) {
      expect(sql).toContain("FROM lyrix_events");
      expect(sql).toContain("INTERVAL '30' DAY");
      expect(sql).not.toMatch(/COUNT\(/i);
      // Only columns the dataset has.
      for (const [column] of sql.matchAll(/\b(blob|double)\d+\b/g)) expect(column).toMatch(/^(blob([1-9]|1\d|20)|double([1-9]|1\d|20))$/);
    }
  });

  it("reads a visit's fields from the columns the Worker writes them to", () => {
    const [daily] = statsQueries(7);
    // landed is double1; the screens are double2 to double6.
    expect(daily.sql).toContain("SUM(_sample_interval * double1) AS visits");
    expect(daily.sql).toContain("(double2 + double3 + double4 + double5 + double6)");
  });

  it("posts each query to the account's SQL API, and reads its rows", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ day: "2026-10-20 00:00:00", visits: "12" }] })));
    const rows = await runQuery("SELECT 1", config, fetchMock);
    expect(rows).toEqual([{ day: "2026-10-20 00:00:00", visits: "12" }]);
    expect(fetchMock).toHaveBeenCalledWith("https://api.cloudflare.com/client/v4/accounts/acc123/analytics_engine/sql", {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
      body: "SELECT 1 FORMAT JSON",
    });
  });

  it("says what the API answered when it refuses", async () => {
    const refusing = vi.fn(async () => new Response("Authentication error", { status: 403 }));
    await expect(runQuery("SELECT 1", config, refusing)).rejects.toThrow(/answered 403: Authentication error/);
    const odd = vi.fn(async () => new Response(JSON.stringify({ errors: ["?"] })));
    await expect(runQuery("SELECT 1", config, odd)).rejects.toThrow(/unexpected answer/);
  });

  it("prints rows as an aligned table, days without their time and averages to one decimal", () => {
    expect(
      formatTable("Visits", [
        { day: "2026-10-19 00:00:00", visits: "8", tries: "31.25" },
        { day: "2026-10-20 00:00:00", visits: 120, tries: 40 },
      ])
    ).toBe(
      [
        "Visits",
        "  day         visits  tries",
        "  ----------  ------  -----",
        "  2026-10-19  8       31.3",
        "  2026-10-20  120     40",
      ].join("\n")
    );
    expect(formatTable("Rooms", [])).toBe("Rooms\n  (nothing yet)");
  });

  it("looks back 7 days unless told otherwise", () => {
    expect(daysFromArgs([])).toBe(7);
    expect(daysFromArgs(["--days", "30"])).toBe(30);
    for (const args of [["--days"], ["--days", "0"], ["--days", "abc"], ["--days", "400"]]) {
      expect(() => daysFromArgs(args)).toThrow(/--days/);
    }
  });
});

import { Hono } from "hono";
import { parseVisitReport } from "../../src/game/visit";
import { deviceOf, recordEvent, type EventsEnv } from "./events";

/**
 * POST /api/visit: a page's audience report (src/stats.ts), counted as one
 * data point (worker/src/events.ts). Sent as text/plain, so a browser sends
 * it across origins without a preflight: one request per report, on a free
 * plan that counts them. The Worker adds the device's kind and the country
 * Cloudflare places the request in, never the IP address or the
 * User-Agent itself.
 *
 * Always 204, whatever came: the page doesn't wait on it, and nothing is
 * to be learnt from it.
 */
export const visitRoutes = new Hono<{ Bindings: EventsEnv }>();

/** What Cloudflare tells about a request, the country alone (absent under plain-Node tests). */
function countryOf(request: Request): string {
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : "";
}

visitRoutes.post("/", async (c) => {
  let body: unknown = null;
  try {
    body = JSON.parse(await c.req.text());
  } catch {
    // Counted as nothing.
  }
  const report = parseVisitReport(body);
  if (report) {
    recordEvent(c.env, "visit", {
      entry: report.entry,
      referrer: report.referrer,
      source: report.source,
      medium: report.medium,
      campaign: report.campaign,
      device: deviceOf(c.req.header("User-Agent")),
      country: countryOf(c.req.raw),
      display: report.display,
      landed: report.landed ? 1 : 0,
      ...report.views,
    });
  }
  return c.body(null, 204);
});

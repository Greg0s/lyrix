import { Hono } from "hono";
import { parseClientErrorReport } from "../../src/game/clientError";
import { recordEvent, type EventsEnv } from "./events";

/**
 * POST /api/client-error: an error a player's browser met running the game
 * (src/errorReport.ts). Written to the Worker's logs (Workers Logs,
 * worker/wrangler.toml's [observability]), stack included, for the few
 * days they are kept, and counted (an `error` event, `npm run stats`), so
 * a bug is seen even once its logs are gone. Text/plain, like a visit's
 * report: no preflight. Always 204.
 */
export const clientErrorRoutes = new Hono<{ Bindings: EventsEnv }>();

clientErrorRoutes.post("/", async (c) => {
  let body: unknown = null;
  try {
    body = JSON.parse(await c.req.text());
  } catch {
    // Counted as nothing.
  }
  const report = parseClientErrorReport(body);
  if (report) {
    const where = report.source ? ` at ${report.source}:${report.line}:${report.column}` : "";
    console.error(
      `client ${report.kind} on ${report.page || "?"}: ${report.message}${where}${report.stack ? `\n${report.stack}` : ""}`
    );
    recordEvent(c.env, "error", {
      kind: report.kind,
      page: report.page,
      message: report.message.slice(0, 100),
      source: report.source,
      line: report.line,
    });
  }
  return c.body(null, 204);
});

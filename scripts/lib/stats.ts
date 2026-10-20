import { columnOf, type EventName } from "../../worker/src/events";
import { VIEW_PAGES } from "../../src/game/visit";

/**
 * `npm run stats` (scripts/stats.ts): the game's statistics, read back from
 * Workers Analytics Engine through its SQL API. Every column a query names
 * comes from the table the Worker writes with (worker/src/events.ts,
 * columnOf), so a query can't read a field from where it isn't.
 *
 * Analytics Engine may sample what it keeps: each row stands for
 * `_sample_interval` events, so a count is SUM(_sample_interval), never
 * COUNT(), and an average is weighted by it.
 */

export const DATASET = "lyrix_events";

export interface StatsConfig {
  accountId: string;
  apiToken: string;
}

/** The environment variables the script reads, and how to get each. */
export const STATS_ENV = {
  CLOUDFLARE_ACCOUNT_ID: "the Cloudflare account's id (dashboard, Workers & Pages, right-hand column)",
  CLOUDFLARE_API_TOKEN:
    "an API token with the Account > Account Analytics > Read permission (dashboard, My Profile, API Tokens)",
} as const;

/** The configuration from `env`, or an error naming every variable missing and how to set it. */
export function statsConfig(env: Record<string, string | undefined>): StatsConfig {
  const missing = (Object.keys(STATS_ENV) as (keyof typeof STATS_ENV)[]).filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `stats: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set.\n` +
        missing.map((name) => `  ${name}: ${STATS_ENV[name]}`).join("\n") +
        "\nPut them in .env at the repository's root (gitignored), or in the environment."
    );
  }
  return { accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "", apiToken: env.CLOUDFLARE_API_TOKEN ?? "" };
}

const col = columnOf;

const WEIGHT = "_sample_interval";
const count = `SUM(${WEIGHT})`;
const weighted = (column: string) => `SUM(${WEIGHT} * ${column})`;
const average = (column: string) => `SUM(${WEIGHT} * ${column}) / SUM(${WEIGHT})`;
const DAY = "toStartOfInterval(timestamp, INTERVAL '1' DAY)";

function where(event: EventName, days: number, extra = ""): string {
  return `WHERE blob1 = '${event}' AND timestamp > NOW() - INTERVAL '${days}' DAY${extra ? ` AND ${extra}` : ""}`;
}

/** A visit's landing report: one per visit (src/game/visit.ts). */
const landed = `${col("visit", "landed")} = 1`;
const views = VIEW_PAGES.map((page) => col("visit", page)).join(" + ");

export interface StatsQuery {
  title: string;
  sql: string;
}

/** The queries `npm run stats` runs, over the last `days` days. */
export function statsQueries(days: number): StatsQuery[] {
  const visitBy = (field: "entry" | "referrer" | "device" | "display" | "country") =>
    `SELECT ${col("visit", field)} AS ${field}, ${weighted(col("visit", "landed"))} AS visits FROM ${DATASET} ` +
    `${where("visit", days, landed)} GROUP BY ${field} ORDER BY visits DESC LIMIT 15`;
  return [
    {
      title: "Visits and screens seen, per day",
      sql:
        `SELECT ${DAY} AS day, ${weighted(col("visit", "landed"))} AS visits, ${weighted(`(${views})`)} AS views ` +
        `FROM ${DATASET} ${where("visit", days)} GROUP BY day ORDER BY day`,
    },
    {
      title: "Screens seen",
      sql:
        `SELECT ${VIEW_PAGES.map((page) => `${weighted(col("visit", page))} AS ${page}`).join(", ")} ` +
        `FROM ${DATASET} ${where("visit", days)}`,
    },
    { title: "Where visits came from", sql: visitBy("referrer") },
    {
      title: "Campaigns (utm_source, utm_medium, utm_campaign)",
      sql:
        `SELECT ${col("visit", "source")} AS source, ${col("visit", "medium")} AS medium, ` +
        `${col("visit", "campaign")} AS campaign, ${weighted(col("visit", "landed"))} AS visits FROM ${DATASET} ` +
        `${where("visit", days, `${landed} AND ${col("visit", "source")} != ''`)} ` +
        `GROUP BY source, medium, campaign ORDER BY visits DESC LIMIT 15`,
    },
    { title: "First screen", sql: visitBy("entry") },
    { title: "Devices", sql: visitBy("device") },
    { title: "Installed app or browser", sql: visitBy("display") },
    { title: "Countries", sql: visitBy("country") },
    {
      title: "Solo rounds started (a first guess), per day played",
      sql:
        `SELECT ${col("start", "day")} AS day, ${col("start", "kind")} AS kind, ${count} AS started FROM ${DATASET} ` +
        `${where("start", days)} GROUP BY day, kind ORDER BY day DESC`,
    },
    {
      title: "Rounds won, per day played: guesses and hints it took, on average",
      sql:
        `SELECT ${col("win", "day")} AS day, ${col("win", "mode")} AS mode, ${count} AS won, ` +
        `${average(col("win", "tries"))} AS tries, ${average(col("win", "hints"))} AS hints FROM ${DATASET} ` +
        `${where("win", days)} GROUP BY day, mode ORDER BY day DESC, mode DESC`,
    },
    {
      title: "Hints revealed",
      sql:
        `SELECT ${col("hint", "hint")} AS hint, ${col("hint", "mode")} AS mode, ${count} AS reveals, ` +
        `${average(col("hint", "tries"))} AS after_tries FROM ${DATASET} ${where("hint", days)} ` +
        `GROUP BY hint, mode ORDER BY reveals DESC`,
    },
    {
      title: "Rooms",
      sql:
        `SELECT ${col("room", "action")} AS action, ${count} AS times, ${average(col("room", "members"))} AS members ` +
        `FROM ${DATASET} ${where("room", days)} GROUP BY action ORDER BY action`,
    },
  ];
}

export type Row = Record<string, string | number>;

/** Runs `sql` against the SQL API: its rows, or an error saying what the API answered. */
export async function runQuery(sql: string, config: StatsConfig, fetchImpl: typeof fetch = fetch): Promise<Row[]> {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/analytics_engine/sql`,
    { method: "POST", headers: { Authorization: `Bearer ${config.apiToken}` }, body: `${sql} FORMAT JSON` }
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`stats: the SQL API answered ${response.status}: ${text.slice(0, 500)}`);
  const parsed: unknown = JSON.parse(text);
  const data = typeof parsed === "object" && parsed !== null ? (parsed as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) throw new Error(`stats: unexpected answer from the SQL API: ${text.slice(0, 500)}`);
  return data as Row[];
}

/** A value as a table shows it: numbers (which the API may send as strings) rounded, a day without its time. */
function cell(value: string | number | undefined): string {
  if (value === undefined || value === "") return "-";
  if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value)) {
    return /^\d{4}-\d{2}-\d{2} 00:00:00$/.test(value) ? value.slice(0, 10) : value;
  }
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

/** Rows as an aligned text table under its title. */
export function formatTable(title: string, rows: Row[]): string {
  if (rows.length === 0) return `${title}\n  (nothing yet)`;
  const columns = Object.keys(rows[0]);
  const cells = rows.map((row) => columns.map((column) => cell(row[column])));
  const widths = columns.map((column, i) => Math.max(column.length, ...cells.map((line) => line[i].length)));
  const line = (values: string[]) => `  ${values.map((value, i) => value.padEnd(widths[i])).join("  ")}`.trimEnd();
  return [title, line(columns), line(widths.map((width) => "-".repeat(width))), ...cells.map(line)].join("\n");
}

/** How many days back `npm run stats -- --days N` looks; 7 by default. */
export function daysFromArgs(args: readonly string[]): number {
  const index = args.indexOf("--days");
  if (index === -1) return 7;
  const days = Number(args[index + 1]);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("stats: --days takes a whole number of days, 1 to 365");
  return days;
}

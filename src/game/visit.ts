/**
 * The audience report a page sends when the player leaves it (src/stats.ts),
 * and how the Worker reads it (POST /api/visit, worker/src/visit.ts): what
 * pages were seen, where the visit came from, and nothing that tells one
 * visit from another. No identifier is ever made, read or sent: a report is
 * counted, never linked to another one (the legal page says so, and the
 * CNIL's exemption for audience measurement asks it).
 */

/** The screens a visit is counted on (src/routes.ts), by kind: a day of the archives is "day", whichever. */
export const VIEW_PAGES = ["today", "day", "archives", "help", "legal"] as const;
export type ViewPage = (typeof VIEW_PAGES)[number];

/** Where a visit can start: a screen, or an invite link (/salon/<code>, its code never sent). */
export const ENTRY_PAGES = [...VIEW_PAGES, "invite"] as const;
export type EntryPage = (typeof ENTRY_PAGES)[number];

/** Whether the page was opened as the installed app (#79) or in a browser tab. */
export type DisplayMode = "app" | "browser";

export interface VisitReport {
  /** The load's first report: what makes it a visit. Later ones (the tab hidden, then left) only add views. */
  landed: boolean;
  entry: EntryPage;
  /** The site the visit came from, its host alone (`news.ycombinator.com`); "" for none or this site. */
  referrer: string;
  /** A link's campaign (utm_source, utm_medium, utm_campaign), "" when it had none. */
  source: string;
  medium: string;
  campaign: string;
  display: DisplayMode;
  /** How many times each screen was shown since the last report. */
  views: Record<ViewPage, number>;
}

/** No more views per screen in one report than this: a report is a person's, not a script's. */
export const MAX_VIEWS_PER_PAGE = 100;
const MAX_HOST_LENGTH = 100;
const MAX_CAMPAIGN_LENGTH = 40;

/** A host as a report keeps it, or "" for anything that isn't one. */
export function cleanHost(host: unknown): string {
  if (typeof host !== "string") return "";
  const lower = host.toLowerCase();
  return lower.length <= MAX_HOST_LENGTH && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(lower) ? lower : "";
}

/** A campaign field as a report keeps it: lower case, letters, digits, `.`, `_` and `-` only, short. */
export function cleanCampaign(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_CAMPAIGN_LENGTH);
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(MAX_VIEWS_PER_PAGE, Math.max(0, Math.floor(value)))
    : 0;
}

function isEntryPage(value: unknown): value is EntryPage {
  return typeof value === "string" && (ENTRY_PAGES as readonly string[]).includes(value);
}

/** No view of any screen yet. */
export function noViews(): Record<ViewPage, number> {
  return { today: 0, day: 0, archives: 0, help: 0, legal: 0 };
}

/**
 * A report as the Worker counts it, from whatever a client sent: every
 * field checked and cleaned, so nothing but the values above is ever
 * written. Null for anything that isn't a report.
 */
export function parseVisitReport(body: unknown): VisitReport | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.landed !== "boolean" || !isEntryPage(raw.entry)) return null;
  const sent = typeof raw.views === "object" && raw.views !== null ? (raw.views as Record<string, unknown>) : {};
  const views = noViews();
  for (const page of VIEW_PAGES) views[page] = count(sent[page]);
  return {
    landed: raw.landed,
    entry: raw.entry,
    referrer: cleanHost(raw.referrer),
    source: cleanCampaign(raw.source),
    medium: cleanCampaign(raw.medium),
    campaign: cleanCampaign(raw.campaign),
    display: raw.display === "app" ? "app" : "browser",
    views,
  };
}

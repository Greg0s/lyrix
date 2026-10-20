import { apiUrl } from "./api/base";
import { parseInvitePath } from "./game/room";
import { cleanCampaign, cleanHost, noViews, type EntryPage, type ViewPage, type VisitReport } from "./game/visit";
import { parseRoute, type Route } from "./routes";

/**
 * The audience measurement: one report per page left (src/game/visit.ts),
 * sent when the tab is hidden, which is also what a phone does before it
 * closes it. One request whatever the number of screens seen, on a free
 * plan that counts every request the Worker answers.
 *
 * Nothing is sent when the player said no: the legal page's checkbox
 * (stored on this device, the one thing kept for this), or a browser that
 * asks not to be tracked (Do Not Track, Global Privacy Control). That is
 * what the CNIL asks of an audience measurement exempt from consent.
 */

const OPT_OUT_KEY = "lyrix:no-stats";

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Whether the player turned the measurement off on this device (the legal page's checkbox). */
export function isStatsOptedOut(): boolean {
  try {
    return storage()?.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStatsOptedOut(optedOut: boolean): void {
  memoryOptOut = optedOut;
  try {
    if (optedOut) storage()?.setItem(OPT_OUT_KEY, "1");
    else storage()?.removeItem(OPT_OUT_KEY);
  } catch {
    // Storage refused (private mode): the choice lasts as long as the page.
  }
}

// The choice made on this page, for a browser whose storage refused to keep it.
let memoryOptOut = false;

/** Whether the browser itself asks not to be tracked. */
export function browserRefusesTracking(nav: Navigator = navigator): boolean {
  const signals = nav as Navigator & { globalPrivacyControl?: boolean };
  return signals.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/** Whether a report may be sent now. */
export function statsAllowed(): boolean {
  return !memoryOptOut && !isStatsOptedOut() && !browserRefusesTracking();
}

/** The screen kind a route is counted as. */
export function viewPageOf(route: Route): ViewPage {
  return route.name;
}

/** This page load's visit, and whether it has anything the last report didn't say. */
interface Visit {
  report: VisitReport;
  pending: boolean;
}

let visit: Visit | null = null;

/**
 * The report a page load starts with, its first screen counted: read once,
 * before anything rewrites the address (an invite link becomes /).
 */
export function firstReport(location: Location, referrer: string, installed: boolean): VisitReport {
  const route = parseRoute(location.pathname);
  const entry: EntryPage = parseInvitePath(location.pathname) !== null ? "invite" : viewPageOf(route);
  let referrerHost = "";
  try {
    const from = new URL(referrer);
    if (from.host !== location.host) referrerHost = cleanHost(from.hostname);
  } catch {
    // No referrer, or not a URL.
  }
  const params = new URLSearchParams(location.search);
  const views = noViews();
  views[viewPageOf(route)] = 1;
  return {
    landed: true,
    entry,
    referrer: referrerHost,
    source: cleanCampaign(params.get("utm_source") ?? params.get("ref")),
    medium: cleanCampaign(params.get("utm_medium")),
    campaign: cleanCampaign(params.get("utm_campaign")),
    display: installed ? "app" : "browser",
    views,
  };
}

/**
 * The report for what happened since the last one, or null when there is
 * nothing new to say. Only the first is the visit's `landed` one: the rest
 * add the screens seen since (the tab hidden, shown again, then left).
 */
export function takeReport(): VisitReport | null {
  if (!visit || !visit.pending) return null;
  const report = visit.report;
  visit.report = { ...report, landed: false, views: noViews() };
  visit.pending = false;
  return report;
}

function send(report: VisitReport): void {
  const url = apiUrl("/api/visit").toString();
  // A string goes as text/plain: no preflight, across origins.
  const body = JSON.stringify(report);
  try {
    if (navigator.sendBeacon?.(url, body)) return;
  } catch {
    // Some browsers throw rather than refuse.
  }
  void fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
}

/** Sends what is new, if the player allows it; what they refused is dropped, never sent later. */
export function flushVisit(): void {
  const report = takeReport();
  if (report && statsAllowed()) send(report);
}

/** The player went to another screen (useRoute): the first one is the report's own. */
export function countView(route: Route): void {
  if (!visit) return;
  visit.report.views[viewPageOf(route)] += 1;
  visit.pending = true;
}

/** Starts counting this page load's visit (main.tsx, before React reads or rewrites the address). */
export function startVisit(): void {
  if (visit || typeof window === "undefined") return;
  const installed = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  visit = { report: firstReport(window.location, document.referrer, installed), pending: true };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushVisit();
  });
  // Where visibilitychange doesn't fire on leaving (older Safari).
  window.addEventListener("pagehide", flushVisit);
}

/** Forgets the visit and the choice made on the page: tests only (the listeners stay, and do nothing). */
export function resetVisit(): void {
  visit = null;
  memoryOptOut = false;
}

import { apiUrl } from "./api/base";
import { scrubAddresses, trimStack, type ClientErrorReport, type ErrorKind } from "./game/clientError";
import { parseRoute } from "./routes";

/**
 * Errors met in players' browsers, reported to the Worker (POST
 * /api/client-error), which writes them to its logs and counts them (`npm
 * run stats`): a bug nobody reports would otherwise never be seen. Only
 * the game's own errors (a script of this site, or one with no address),
 * never a browser extension's; at most a few per page load, each once.
 */

/** No more reports than this per page load: a loop that throws costs one request a few times, not a quota. */
export const MAX_REPORTS_PER_LOAD = 5;

const reported = new Set<string>();

/** The report for an error, or null for one that isn't the game's to report. */
export function reportFor(
  kind: ErrorKind,
  { message, source, line, column, error }: { message: string; source?: string; line?: number; column?: number; error?: unknown },
  location: Pick<Location, "origin" | "pathname"> = window.location
): ClientErrorReport | null {
  if (source) {
    // Another origin's script (an extension's, a browser's own) isn't the game's bug.
    try {
      if (new URL(source, location.origin).origin !== location.origin) return null;
    } catch {
      return null;
    }
  }
  // A cross-origin script's error, which the browser hides: nothing to act on.
  if (message === "Script error." && !source) return null;
  return {
    kind,
    message: scrubAddresses(message).slice(0, 200),
    source: source ? scrubAddresses(source) : "",
    line: line ?? 0,
    column: column ?? 0,
    stack: error instanceof Error ? trimStack(error.stack) : "",
    page: parseRoute(location.pathname).name,
  };
}

/** Sends `report` unless it was sent already, or the page has sent its share. */
export function sendReport(report: ClientErrorReport): boolean {
  const key = `${report.kind}\u0000${report.message}\u0000${report.source}:${report.line}`;
  if (reported.has(key) || reported.size >= MAX_REPORTS_PER_LOAD) return false;
  reported.add(key);
  const url = apiUrl("/api/client-error").toString();
  // A string goes as text/plain: no preflight, across origins.
  const body = JSON.stringify(report);
  try {
    if (navigator.sendBeacon?.(url, body)) return true;
  } catch {
    // Fall through to fetch.
  }
  void fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
  return true;
}

function describe(reason: unknown): { message: string; error?: unknown } {
  if (reason instanceof Error) return { message: `${reason.name}: ${reason.message}`, error: reason };
  return { message: typeof reason === "string" ? reason : "a promise was rejected with no error" };
}

let started = false;

/** Starts reporting the page's uncaught errors (main.tsx). */
export function startErrorReports(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("error", (event) => {
    // A resource that failed to load (an image) fires a plain Event, not an ErrorEvent.
    if (!(event instanceof ErrorEvent)) return;
    const report = reportFor("error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
    if (report) sendReport(report);
  });
  window.addEventListener("unhandledrejection", (event) => {
    // An aborted request (a guess superseded, a page left) is no bug.
    if (event.reason instanceof DOMException && event.reason.name === "AbortError") return;
    const { message, error } = describe(event.reason);
    const report = reportFor("rejection", { message, error });
    if (report) sendReport(report);
  });
}

/** Forgets what was reported: tests only. */
export function resetErrorReports(): void {
  reported.clear();
}

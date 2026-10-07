import { INVITE_PATH } from "../game/room";

/**
 * What the service worker (sw.ts, #79) does with each request, decided here,
 * apart from its event handlers: shared with the build that writes its file
 * list (scripts/lib/serviceWorker.ts) and with src/pwa.ts, which registers it.
 */

/** Where the build writes the service worker. public/_headers keeps every cache on the way from holding it. */
export const SERVICE_WORKER_PATH = "/sw.js";

/** The app shell: the page every address answers with (index.html), kept for when the network can't answer. */
export const SHELL_URL = "/";

/**
 * Every cache the worker keeps is named `lyrix-<what>-<version>`; once a new
 * version takes over, the caches of every other one are deleted.
 */
export const CACHE_PREFIX = "lyrix-";

/**
 * How long a page's address may take to answer before the worker gives up
 * on the network and opens the app shell it kept: a phone on a flaky
 * connection gets the game, and its own requests a chance, instead of a
 * blank page that never ends loading.
 */
export const NAVIGATION_TIMEOUT_MS = 3_000;

/** Google Fonts: the stylesheet index.html links, and the font files it points to. */
export const FONT_STYLESHEET_ORIGIN = "https://fonts.googleapis.com";
export const FONT_FILE_ORIGIN = "https://fonts.gstatic.com";

/**
 * Paths the worker never answers, page or not: the API, the only source of
 * truth on a round (and the day's song turns at UTC midnight), and invite
 * links, which Pages answers with the invite page (public/_redirects), its
 * link preview included, never with the app shell.
 */
export const NETWORK_ONLY_PATHS: readonly string[] = ["/api", INVITE_PATH.replace(/\/$/, "")];

/** A build's files and the version they make up, written into the worker by the build. */
export interface Precache {
  version: string;
  /** Absolute paths: the app shell, the bundled scripts and styles, the icons and the manifest. */
  urls: string[];
}

/**
 * - network: left alone, as if there were no worker;
 * - page: an address of the app, from the network, or the app shell when it can't answer;
 * - precached: a file of this build, from the cache;
 * - font-stylesheet: from the cache, refreshed in the background;
 * - font-file: from the cache once fetched (its address changes with its content).
 */
export type Strategy = "network" | "page" | "precached" | "font-stylesheet" | "font-file";

/** What a strategy needs of a request: a fetch event's Request has all of it. */
export interface RequestShape {
  url: string;
  method: string;
  mode: string;
}

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** How the worker on `origin`, holding `precached`, answers `request`. */
export function strategyFor(request: RequestShape, origin: string, precached: ReadonlySet<string>): Strategy {
  if (request.method !== "GET") return "network";
  const url = new URL(request.url);
  if (url.origin === FONT_STYLESHEET_ORIGIN) return "font-stylesheet";
  if (url.origin === FONT_FILE_ORIGIN) return "font-file";
  // The API in production, among others: on its own origin, out of the worker's reach.
  if (url.origin !== origin) return "network";
  if (NETWORK_ONLY_PATHS.some((prefix) => under(url.pathname, prefix))) return "network";
  if (request.mode === "navigate") return "page";
  return url.search === "" && precached.has(url.pathname) ? "precached" : "network";
}

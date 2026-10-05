import type { HtmlTagDescriptor, Plugin } from "vite";

/**
 * In production the game and its API are on different origins (Pages and the
 * Worker, see src/api/base.ts), so the first call to the API - the day's
 * round, on a first visit - opened its own connection (DNS, TCP, TLS) only
 * once the app's script had loaded and React had mounted: a few hundred
 * milliseconds on a phone, on the request the loading screen waits for.
 * A preconnect in index.html opens it while the script is still in flight.
 *
 * `crossorigin` because the API is fetched in CORS mode, without credentials:
 * a preconnect without it opens a connection those requests can't use.
 */
export function apiPreconnectTags(apiBase: string | undefined): HtmlTagDescriptor[] {
  // Unset in dev and e2e: the API is same-origin, behind Vite's proxy.
  if (!apiBase) return [];
  let origin: string;
  try {
    origin = new URL(apiBase).origin;
  } catch {
    return [];
  }
  return [{ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: true }, injectTo: "head" }];
}

/** Adds the API's preconnect to index.html when the build names the API's own origin (VITE_API_BASE_URL). */
export function apiPreconnectPlugin(): Plugin {
  let apiBase: string | undefined;
  return {
    name: "lyrix:api-preconnect",
    configResolved(config) {
      const value: unknown = config.env.VITE_API_BASE_URL;
      apiBase = typeof value === "string" ? value : undefined;
    },
    transformIndexHtml: () => apiPreconnectTags(apiBase),
  };
}

import type { HtmlTagDescriptor, Plugin } from "vite";

/**
 * Umami (umami.is), the site's audience measurement next to the Worker's own
 * counts (src/stats.ts): a cookieless tracker on the developer's own Umami
 * instance, loaded from index.html's head.
 *
 * Production only: the tag is added when the build names the API's own origin
 * (VITE_API_BASE_URL, set by the deploy alone), so dev, e2e and a local
 * preview never load it nor count a visit (tests/e2e/privacy.spec.ts still
 * holds for them). `data-domains` keeps a copy of the build served elsewhere
 * from counting either, and `data-do-not-track` honours the browser's Do Not
 * Track; the legal page's opt-out sets `umami.disabled` (setStatsOptedOut).
 */
export const UMAMI_SCRIPT_URL = "https://umami-y1mc.vercel.app/script.js";
export const UMAMI_WEBSITE_ID = "0000a6f3-2e7b-4fa6-a4bc-a37fb28e3d59";
export const UMAMI_DOMAIN = "lyrix.mintymoon.app";

export function umamiTags(apiBase: string | undefined): HtmlTagDescriptor[] {
  if (!apiBase) return [];
  return [
    {
      tag: "script",
      attrs: {
        defer: true,
        src: UMAMI_SCRIPT_URL,
        "data-website-id": UMAMI_WEBSITE_ID,
        "data-domains": UMAMI_DOMAIN,
        "data-do-not-track": "true",
      },
      injectTo: "head",
    },
  ];
}

/** Adds Umami's script to index.html in production builds (see umamiTags). */
export function umamiPlugin(): Plugin {
  let apiBase: string | undefined;
  return {
    name: "lyrix:umami",
    configResolved(config) {
      const value: unknown = config.env.VITE_API_BASE_URL;
      apiBase = typeof value === "string" ? value : undefined;
    },
    transformIndexHtml: () => umamiTags(apiBase),
  };
}

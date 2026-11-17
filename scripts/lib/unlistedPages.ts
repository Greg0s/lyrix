import type { Plugin } from "vite";
import { ARCHIVES, LEGAL, routePath, routeTitle, type Route } from "../../src/routes";
import { replaceOnce, setMeta, SITE } from "./htmlPage";

/**
 * The pages a search engine should leave out of its results: the legal
 * notice (`/mentions-legales`) and the archives (`/archives`). Served by
 * Pages' SPA fallback, both answered with index.html itself: the home page's
 * title, description, canonical link and text. Google took them for copies of
 * the home page, and picked the legal notice to stand for the whole group: a
 * search for "Lyrix jeu" led to it first, dated by its "Dernière mise à jour"
 * (docs/LEARNINGS.md, 2026-11-13).
 *
 * Each is now index.html under head tags of its own, its own canonical link,
 * and `noindex, follow`: never listed, its links still followed. Emitted as
 * `<name>.html`, which Cloudflare Pages serves at `/<name>` (its pretty URLs),
 * like the rules' page (rulesPage.ts). A day of the archives
 * (`/archives/<day>`) has no file to answer it: public/_headers sends it the
 * same `noindex` as a header.
 */

interface UnlistedPage {
  route: Route;
  description: string;
  /** What #root says before the app runs, under the page's title. */
  lead: string;
}

export const UNLISTED_PAGES: readonly UnlistedPage[] = [
  {
    route: LEGAL,
    description: "Mentions légales de Lyrix et politique de confidentialité : hébergeur, données conservées, mesure d'audience.",
    lead: "Qui publie Lyrix, qui l'héberge, et ce que le jeu garde ou envoie de tes données.",
  },
  {
    route: ARCHIVES,
    description: "Les chansons des 30 derniers jours de Lyrix, à rejouer si tu en as manqué une.",
    lead: "Les chansons des 30 derniers jours, à rejouer si tu en as manqué une.",
  },
];

export const NOINDEX = "noindex, follow";

/** The page's file in the build, and its address. */
export function unlistedPageFile(page: UnlistedPage): string {
  return `${routePath(page.route).slice(1)}.html`;
}

export function unlistedPageUrl(page: UnlistedPage): string {
  return `${SITE}${routePath(page.route).slice(1)}`;
}

/** The page's heading before the app runs: its title, without the site's name the tab adds. */
export function unlistedPageHeading(page: UnlistedPage): string {
  return routeTitle(page.route).replace(/ - Lyrix$/, "");
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** index.html, as one of these pages. */
export function unlistedPageHtml(indexHtml: string, page: UnlistedPage): string {
  const title = routeTitle(page.route);
  const url = unlistedPageUrl(page);
  let html = indexHtml;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, () => `<title>${escapeText(title)}</title>`, "<title>");
  html = setMeta(html, "description", page.description);
  html = replaceOnce(
    html,
    /<link rel="canonical" href="[^"]*" \/>/,
    () => `<link rel="canonical" href="${url}" />\n    <meta name="robots" content="${NOINDEX}" />`,
    "canonical link"
  );
  html = setMeta(html, "og:url", url);
  html = setMeta(html, "og:title", title);
  html = setMeta(html, "og:description", page.description);
  // The site's and the game's structured data are the home page's alone.
  html = replaceOnce(html, /\s*<script type="application\/ld\+json">.*?<\/script>/s, "", "JSON-LD block");
  html = replaceOnce(
    html,
    /(<h1 class="lyrix-static-title">)[^<]*(<\/h1>\s*<p>).*?(<\/p>)/s,
    () => `<h1 class="lyrix-static-title">${escapeText(unlistedPageHeading(page))}</h1>\n        <p>${escapeText(page.lead)}</p>`,
    "#root's heading"
  );
  return html;
}

/** Emits these pages with the build, and serves them in dev at their addresses. */
export function unlistedPagesPlugin(): Plugin {
  return {
    name: "lyrix:unlisted-pages",
    // After Vite's own HTML plugin has written index.html into the bundle.
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (!context.server) return html;
        const path = (context.originalUrl ?? context.path).split(/[?#]/)[0].replace(/\/+$/, "");
        const page = UNLISTED_PAGES.find((candidate) => routePath(candidate.route) === path);
        return page ? unlistedPageHtml(html, page) : html;
      },
    },
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index?.type !== "asset") return;
      const source = typeof index.source === "string" ? index.source : new TextDecoder().decode(index.source);
      for (const page of UNLISTED_PAGES) {
        this.emitFile({ type: "asset", fileName: unlistedPageFile(page), source: unlistedPageHtml(source, page) });
      }
    },
  };
}

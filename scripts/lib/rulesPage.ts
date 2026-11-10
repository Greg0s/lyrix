import type { Plugin } from "vite";
import { FAQ, RULES_DESCRIPTION, RULES_TITLE } from "../../src/rules";
import { HELP_PATH } from "../../src/routes";
import { replaceOnce, setMeta, SITE } from "./htmlPage";

/**
 * The page the rules' address (`/comment-jouer`, src/routes.ts) is served:
 * the app itself, under head tags of its own. Without it, Pages' SPA
 * fallback answered with index.html, whose title and canonical link name the
 * home page, so search engines took the rules for a copy of it and left them
 * out, sitemap or not. And crawlers that don't run scripts (AI ones above
 * all) found nothing of the rules there: their questions and answers are in
 * the page as structured data (FAQPage), from the same list the page shows.
 *
 * Emitted as `comment-jouer.html`, which Cloudflare Pages serves at
 * `/comment-jouer` (its pretty URLs). Derived from the built index.html, like
 * the invite page, so it never drifts from the app. The dev server does the
 * same on the fly.
 */

export const RULES_PAGE = {
  file: `${HELP_PATH.slice(1)}.html`,
  url: `${SITE}${HELP_PATH.slice(1)}`,
} as const;

/** The FAQ as schema.org data, linked to the game the home page describes. */
export function rulesJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${RULES_PAGE.url}#faq`,
        url: RULES_PAGE.url,
        name: RULES_TITLE,
        description: RULES_DESCRIPTION,
        inLanguage: "fr",
        isPartOf: { "@id": `${SITE}#website` },
        about: { "@id": `${SITE}#game` },
        mainEntity: FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}

/** JSON inside a <script>: no `<` that could close it early. */
function scriptJson(data: object): string {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c").replace(/\n/g, "\n      ");
}

/** index.html, as the rules' page. */
export function rulesPageHtml(indexHtml: string): string {
  let html = indexHtml;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, () => `<title>${RULES_TITLE}</title>`, "<title>");
  html = setMeta(html, "description", RULES_DESCRIPTION);
  html = replaceOnce(
    html,
    /<link rel="canonical" href="[^"]*" \/>/,
    () => `<link rel="canonical" href="${RULES_PAGE.url}" />`,
    "canonical link"
  );
  html = setMeta(html, "og:url", RULES_PAGE.url);
  html = setMeta(html, "og:title", RULES_TITLE);
  html = setMeta(html, "og:description", RULES_DESCRIPTION);
  html = replaceOnce(
    html,
    /(<script type="application\/ld\+json">).*?(<\/script>)/s,
    () => `<script type="application/ld+json">\n      ${scriptJson(rulesJsonLd())}\n    </script>`,
    "JSON-LD block"
  );
  return html;
}

/** Emits the rules' page with the build, and serves it in dev at its address. */
export function rulesPagePlugin(): Plugin {
  return {
    name: "lyrix:rules-page",
    // After Vite's own HTML plugin has written index.html into the bundle.
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (!context.server) return html;
        const path = (context.originalUrl ?? context.path).split(/[?#]/)[0].replace(/\/+$/, "");
        return path === HELP_PATH ? rulesPageHtml(html) : html;
      },
    },
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index?.type !== "asset") return;
      const source = typeof index.source === "string" ? index.source : new TextDecoder().decode(index.source);
      this.emitFile({ type: "asset", fileName: RULES_PAGE.file, source: rulesPageHtml(source) });
    },
  };
}

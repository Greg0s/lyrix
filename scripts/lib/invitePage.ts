import type { Plugin } from "vite";
import { INVITE_PATH } from "../../src/game/room";
import { INVITE_IMAGE } from "./socialImage";

/**
 * The page invite links (`/salon/<code>`, src/game/room.ts) are served: the
 * app itself, under a link preview that says it is an invitation to a room.
 * Link unfurlers (WhatsApp, Discord, iMessage…) never run the app's script,
 * so the preview has to be in the HTML the link answers with.
 *
 * It is index.html with its preview rewritten, derived at build time rather
 * than kept as a second copy that would drift: `dist/salon/index.html`, which
 * public/_redirects serves for every `/salon/<code>`. The dev server does the
 * same on the fly.
 *
 * The preview is the same for every code, and never looks the room up: a
 * link must not tell a live code from a dead one (see CLAUDE.md, "Rooms"),
 * and the host's pseudo is personal data a preview would broadcast.
 */

const SITE = "https://lyrix-eyg.pages.dev/";

export const INVITE_PAGE = {
  file: "salon/index.html",
  url: `${SITE}salon/`,
  title: "Rejoins mon salon Lyrix",
  description:
    "On cherche la chanson du jour ensemble : propose des mots pour dévoiler ses paroles et trouvons son titre à plusieurs.",
  imageAlt: "Le logo Lyrix, une invitation à rejoindre un salon, et des paroles masquées par des barres de couleur.",
} as const;

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Replaces `pattern`'s single match, or fails loudly: a preview silently left as the home page's is the bug. */
function replaceOnce(html: string, pattern: RegExp, replacement: string, what: string): string {
  const matches = html.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`));
  if (matches?.length !== 1) throw new Error(`invite page: expected one ${what} in index.html, found ${matches?.length ?? 0}`);
  return html.replace(pattern, replacement);
}

/** Sets a `<meta>`'s content, found by its `name` or `property`. */
function setMeta(html: string, key: string, content: string): string {
  return replaceOnce(
    html,
    new RegExp(`(<meta\\s+(?:name|property)="${key}"\\s+content=")[^"]*(")`, "s"),
    `$1${escapeAttribute(content)}$2`,
    `<meta ${key}>`
  );
}

/** index.html, as the invite page. */
export function invitePageHtml(indexHtml: string): string {
  let html = indexHtml;
  // <title> stays the game's: the page drops to `/` as soon as it loads
  // (GameScreen), and the tab would keep an invitation's name all day.
  html = setMeta(html, "description", INVITE_PAGE.description);
  html = setMeta(html, "og:url", INVITE_PAGE.url);
  html = setMeta(html, "og:title", INVITE_PAGE.title);
  html = setMeta(html, "og:description", INVITE_PAGE.description);
  html = setMeta(html, "og:image", `${SITE}${INVITE_IMAGE.file}`);
  html = setMeta(html, "og:image:width", String(INVITE_IMAGE.width));
  html = setMeta(html, "og:image:height", String(INVITE_IMAGE.height));
  html = setMeta(html, "og:image:alt", INVITE_PAGE.imageAlt);
  // One page per room code, each gone by midnight: nothing for a search engine
  // to list. The canonical link still names the home page, and the game's
  // structured data stays the home page's alone.
  html = replaceOnce(
    html,
    /\s*<script type="application\/ld\+json">.*?<\/script>/s,
    "",
    "JSON-LD block"
  );
  html = replaceOnce(
    html,
    /(<link rel="canonical"[^>]*>)/,
    `$1\n    <meta name="robots" content="noindex" />`,
    "canonical link"
  );
  return html;
}

/** Emits the invite page with the build, and serves it in dev for any `/salon/…` URL. */
export function invitePagePlugin(): Plugin {
  return {
    name: "lyrix:invite-page",
    // After Vite's own HTML plugin has written index.html into the bundle.
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (!context.server) return html;
        const url = context.originalUrl ?? context.path;
        return url.startsWith(INVITE_PATH) ? invitePageHtml(html) : html;
      },
    },
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index?.type !== "asset") return;
      const source = typeof index.source === "string" ? index.source : new TextDecoder().decode(index.source);
      this.emitFile({ type: "asset", fileName: INVITE_PAGE.file, source: invitePageHtml(source) });
    },
  };
}

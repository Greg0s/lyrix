import { type FaviconColors, faviconSvg } from "./favicon";

/**
 * The link-preview image (`og:image` in index.html): the logo mark, the
 * wordmark and a few lines of "lyrics" masked the way the game masks them.
 * Rasterized to public/og-image.png by `npm run favicon:build`, alongside the
 * favicon and from the same palette.
 */

export const SOCIAL_IMAGE = { file: "og-image.png", width: 1200, height: 630 } as const;

/** The faces the image draws with: index.html's, at the weights used here. */
export const SOCIAL_IMAGE_FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Figtree:wght@500&display=block";

/** Masked lines, as word lengths: negative lengths are hidden words (bars). */
const LINES: number[][] = [
  [5, -4, 3, -7, 6],
  [-6, 2, 8, -3, -5],
  [4, -9, 3, 5],
];

function line(words: number[], colors: FaviconColors): string {
  return words
    .map((length) =>
      length < 0
        ? `<span class="bar" style="width:${-length * 0.62}em;background:${colors.accent}"></span>`
        : `<span class="word" style="width:${length * 0.62}em"></span>`
    )
    .join("");
}

/**
 * `fontCss`: SOCIAL_IMAGE_FONTS's stylesheet with the font files inlined, so
 * the page needs no network of its own (see scripts/build-favicon.ts).
 */
export function socialImageHtml(colors: FaviconColors, fontCss: string): string {
  const mark = faviconSvg(colors, { rounded: true }).replace("<svg ", `<svg width="132" height="132" `);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
${fontCss}
  html, body { margin: 0; }
  body {
    width: ${SOCIAL_IMAGE.width}px; height: ${SOCIAL_IMAGE.height}px; box-sizing: border-box;
    padding: 88px 96px; background: ${colors.pageBg}; color: ${colors.ink};
    display: flex; flex-direction: column; justify-content: space-between;
    font-family: "Figtree", system-ui, sans-serif;
  }
  .brand { display: flex; align-items: center; gap: 36px; }
  .wordmark { font-family: "Bricolage Grotesque", system-ui, sans-serif; font-weight: 800; font-size: 150px; letter-spacing: -0.03em; line-height: 1; }
  .i { position: relative; display: inline-block; }
  .dot { position: absolute; left: 50%; top: 0.04em; width: 0.36em; height: 0.14em; border-radius: 0.03em; background: ${colors.accent}; transform: translateX(-50%); }
  .tagline { margin: 0; font-size: 44px; font-weight: 500; line-height: 1.2; text-wrap: balance; }
  .lyrics { display: flex; flex-direction: column; gap: 22px; font-size: 40px; }
  .line { display: flex; gap: 0.45em; }
  .line span { height: 0.5em; border-radius: 0.25em; }
  .word { background: ${colors.ink}; opacity: 0.16; }
</style>
</head>
<body>
  <div class="brand">${mark}<span class="wordmark">Lyr<span class="i">ı<span class="dot"></span></span>x</span></div>
  <p class="tagline">Retrouve la chanson du jour à partir de ses paroles cachées.</p>
  <div class="lyrics">${LINES.map((words) => `<div class="line">${line(words, colors)}</div>`).join("")}</div>
</body>
</html>
`;
}

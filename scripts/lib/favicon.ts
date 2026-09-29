/**
 * The favicon, redrawn in SVG from the CSS logo mark (`.lyrix-logo-mark` in
 * src/styles/game.css, markup in src/components/Logo.tsx).
 *
 * Geometry is the mark's own, in its 36px CSS box: 7.2px side padding, three
 * 4.2px rows 3.6px apart, centred vertically, 2.4px between the pieces of a
 * row. Colors are read from src/styles/tokens.css rather than copied, so a
 * palette change reaches the favicon the next time `npm run favicon:build`
 * runs — and `tests/unit/ci/favicon.test.ts` fails until it does.
 */

export interface FaviconColors {
  ink: string;
  onInk: string;
  accent: string;
  pageBg: string;
}

const SIZE = 36;
const PAD = 7.2;
const ROW_HEIGHT = 4.2;
const ROW_GAP = 3.6;
const PIECE_GAP = 2.4;
const WORD_RADIUS = 2.1;
const BAR_RADIUS = 1;
const CORNER_RADIUS = 9;

type Piece = { kind: "word" | "bar"; width: number | "fill" };

/** One entry per row, left to right, mirroring Logo.tsx. */
const ROWS: Piece[][] = [
  [
    { kind: "word", width: 6.6 },
    { kind: "bar", width: "fill" },
  ],
  [
    { kind: "bar", width: 12 },
    { kind: "word", width: "fill" },
  ],
  [{ kind: "word", width: 14.4 }],
];

const round = (n: number): string => String(Math.round(n * 100) / 100);

function rowRects(colors: FaviconColors): string[] {
  const inner = SIZE - 2 * PAD;
  const top = (SIZE - (ROWS.length * ROW_HEIGHT + (ROWS.length - 1) * ROW_GAP)) / 2;
  const rects: string[] = [];
  ROWS.forEach((row, i) => {
    const fixed = row.reduce((sum, p) => sum + (p.width === "fill" ? 0 : p.width), 0);
    const fill = inner - fixed - PIECE_GAP * (row.length - 1);
    const y = top + i * (ROW_HEIGHT + ROW_GAP);
    let x = PAD;
    for (const piece of row) {
      const width = piece.width === "fill" ? fill : piece.width;
      const radius = piece.kind === "word" ? WORD_RADIUS : BAR_RADIUS;
      const color = piece.kind === "word" ? colors.onInk : colors.accent;
      rects.push(
        `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(ROW_HEIGHT)}" rx="${round(radius)}" fill="${color}"/>`
      );
      x += width + PIECE_GAP;
    }
  });
  return rects;
}

/**
 * `rounded`: the tab icon keeps the mark's rounded corners. The home-screen
 * icon is full-bleed instead, because iOS masks it to its own shape and would
 * paint transparent corners black.
 */
export function faviconSvg(colors: FaviconColors, { rounded }: { rounded: boolean }): string {
  const radius = rounded ? ` rx="${CORNER_RADIUS}"` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `  <rect width="${SIZE}" height="${SIZE}"${radius} fill="${colors.ink}"/>`,
    ...rowRects(colors).map((r) => `  ${r}`),
    `</svg>`,
    ``,
  ].join("\n");
}

/** A custom property's value in a stylesheet, or an error naming it. */
function cssVar(css: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!match) throw new Error(`${name} is not defined in src/styles/tokens.css`);
  return match[1].trim();
}

/** `oklch(L% C H)` or `#rrggbb` to lowercase `#rrggbb` (sRGB, clamped). */
export function cssColorToHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (!m) throw new Error(`unsupported color for the favicon: ${value}`);
  const l = Number(m[1]) / 100;
  const c = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  // OKLab -> LMS -> linear sRGB (Björn Ottosson's reference matrices).
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    "#" +
    linear
      .map((v) => {
        const clamped = Math.min(1, Math.max(0, v));
        const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

export function faviconColors(tokensCss: string): FaviconColors {
  return {
    ink: cssColorToHex(cssVar(tokensCss, "--color-ink")),
    onInk: cssColorToHex(cssVar(tokensCss, "--color-on-ink")),
    accent: cssColorToHex(cssVar(tokensCss, "--accent-solid")),
    pageBg: cssColorToHex(cssVar(tokensCss, "--color-page-bg")),
  };
}

/** The PNG fallbacks: [file in public/, pixel size, rounded corners]. */
export const PNG_ICONS = [
  { file: "favicon-48.png", size: 48, rounded: true },
  { file: "apple-touch-icon.png", size: 180, rounded: false },
] as const;

/**
 * The guided tour a first-time player is shown over today's round
 * (ProductTour.tsx): one tip per key part of the screen, enough to play on
 * their own afterwards. Each step points at the element carrying its
 * `data-tour` attribute; a step whose element isn't on screen (no hints for
 * this song) is left out.
 */

/**
 * How long the tour's invitation (TourInvite.tsx) takes to slide out once
 * answered, before the answer takes effect: game.css's
 * `.lyrix-invite-panel.is-answered` animation.
 */
export const INVITE_LEAVE_MS = 280;

export interface TourStep {
  /** The `data-tour` value of the element the tip points at. */
  target: string;
  title: string;
  body: string;
  /**
   * Scroll the element into view first. Not for what sticks to an edge of the
   * screen (the header, the guess dock): it is always in view, and scrolling
   * "to" it would move the page for nothing.
   */
  scroll: boolean;
}

/** `\u00a0` keeps French punctuation off the start of a line. */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: "title",
    title: "Trouve le titre",
    body: "Chaque barre cache un mot du titre de la chanson du jour, aussi long que le mot. Dévoile-les tous pour gagner.",
    scroll: true,
  },
  {
    target: "lyrics",
    title: "Les paroles sont tes indices",
    body: "Toutes les paroles sont cachées de la même façon. Chaque mot que tu y trouves t'aide à deviner les autres. Touche une barre pour savoir combien de lettres elle cache.",
    scroll: true,
  },
  {
    target: "guess",
    title: "Propose un mot",
    body: "Tape un mot puis valide\u00a0: s'il est dans la chanson, il apparaît partout où il se trouve, dans les paroles comme dans le titre. Accents et majuscules ne comptent pas.",
    scroll: false,
  },
  {
    target: "words",
    title: "Du froid au chaud",
    body: "Un mot absent reçoit un score de proximité, de 0 à 100. S'il est proche d'un mot caché, il s'inscrit dans sa barre, du rouge (à peine proche) au vert (tout proche).",
    scroll: true,
  },
  {
    target: "hints",
    title: "Un coup de pouce",
    body: "Tu bloques\u00a0? À 50, 100 et 150 essais, tu peux révéler un indice\u00a0: l'époque, le type d'artiste ou le style.",
    scroll: true,
  },
  {
    target: "archives",
    title: "Une chanson par jour",
    body: "La même pour tout le monde, nouvelle chaque jour. Tu en as raté une\u00a0? Les 30 derniers jours t'attendent dans les archives.",
    scroll: false,
  },
  {
    target: "help",
    title: "À toi de jouer\u00a0!",
    body: "Un doute en cours de route\u00a0? Les règles complètes sont ici, à tout moment.",
    scroll: false,
  },
];

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TipPlacement {
  /** The tip's top-left corner, in viewport pixels. */
  top: number;
  left: number;
  /** Whether the tip sits under its target (its arrow pointing up) or over it. */
  side: "below" | "above";
  /** The arrow's distance from the tip's left edge, so it points at the target's middle. */
  arrowLeft: number;
}

/** The space kept between the tip and the screen's edges (the page's own side gutter). */
export const TIP_MARGIN = 16;
/** Between the tip and its target's highlight, arrow included. */
export const TIP_GAP = 14;
/** How far the arrow keeps from the tip's rounded corners. */
const ARROW_INSET = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Where the tip goes for a target, both in viewport pixels: under it when it
 * fits, else over it, else on whichever side has more room, never off screen.
 * Horizontally centred on the target, slid back in from the screen's edges.
 */
export function placeTip(target: Box, tip: Size, viewport: Size): TipPlacement {
  const below = target.top + target.height + TIP_GAP;
  const above = target.top - TIP_GAP - tip.height;
  const fitsBelow = below + tip.height <= viewport.height - TIP_MARGIN;
  const fitsAbove = above >= TIP_MARGIN;
  const roomBelow = viewport.height - (target.top + target.height);
  const side = fitsBelow ? "below" : fitsAbove ? "above" : roomBelow >= target.top ? "below" : "above";
  const top = clamp(side === "below" ? below : above, TIP_MARGIN, viewport.height - TIP_MARGIN - tip.height);

  const middle = target.left + target.width / 2;
  const left = clamp(middle - tip.width / 2, TIP_MARGIN, viewport.width - TIP_MARGIN - tip.width);
  const arrowLeft = clamp(middle - left, ARROW_INSET, tip.width - ARROW_INSET);
  return { top, left, side, arrowLeft };
}

/** The highlight around a target: a little larger than it, and cut to the screen when it overflows. */
export function spotlightBox(target: Box, viewport: Size, padding = 6): Box {
  const top = Math.max(target.top - padding, 0);
  const left = Math.max(target.left - padding, 0);
  const bottom = Math.min(target.top + target.height + padding, viewport.height);
  const right = Math.min(target.left + target.width + padding, viewport.width);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

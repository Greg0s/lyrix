import type { HintId, RoundHints } from "./types";

/**
 * A song's hints (decided with the developer): the same three every day, of
 * comparable strength, so which to take depends on what the lyrics already
 * gave away. One more may be revealed at each threshold of guesses, and the
 * player picks which among those left; unlocking one never reveals it. Their
 * text lives on the Worker alone (worker/src/songFacts.ts). Shared by both
 * sides: the Worker checks a reveal against these rules, the card words them.
 */

/** In the order the card shows them. */
export const HINT_IDS: readonly HintId[] = ["era", "artistType", "style"];

export const HINT_LABELS: Readonly<Record<HintId, string>> = {
  era: "Époque",
  artistType: "Type d'artiste",
  style: "Style",
};

/** Guesses at which one more hint may be revealed: the first, the second, the last. */
export const HINT_THRESHOLDS: readonly number[] = [20, 35, 50];

export function isHintId(value: unknown): value is HintId {
  return typeof value === "string" && (HINT_IDS as readonly string[]).includes(value);
}

/** How many hints `tried` guesses allow revealed in all. */
export function unlockedHints(tried: number): number {
  return HINT_THRESHOLDS.filter((threshold) => tried >= threshold).length;
}

/** What a reveal is checked against: the guess count and the hints already taken. */
export interface HintCounts {
  tried: number;
  used: readonly HintId[];
}

/** How many hints may be revealed right now: unlocked, not yet taken. */
export function availableHints({ tried, used }: HintCounts): number {
  return Math.max(0, unlockedHints(tried) - used.length);
}

/** Whether `id` may be revealed now: not already, and a threshold reached that no hint has used up. */
export function canReveal(hints: HintCounts, id: HintId): boolean {
  return !hints.used.includes(id) && availableHints(hints) > 0;
}

/** Hints as a storage entry or a room message carries them: parsed, never trusted. */
export function parseRoundHints(value: unknown): RoundHints | null {
  if (typeof value !== "object" || value === null) return null;
  const { tried, used, values } = value as Record<string, unknown>;
  if (typeof tried !== "number" || !Number.isInteger(tried) || tried < 0) return null;
  if (!Array.isArray(used) || !used.every(isHintId) || new Set(used).size !== used.length) return null;
  if (typeof values !== "object" || values === null) return null;
  const texts: Partial<Record<HintId, string>> = {};
  for (const id of HINT_IDS) {
    const text = (values as Record<string, unknown>)[id];
    if (typeof text === "string") texts[id] = text;
  }
  return { tried, used, values: texts };
}

export type HintRowKind = "choice" | "revealed" | "locked" | "unused";

export interface HintRow {
  id: HintId;
  label: string;
  /** A button while it can be picked; its value once revealed; locked until a threshold allows it; "unused" once won without it. */
  kind: HintRowKind;
  /** Only for a revealed or unused row. */
  value?: string;
}

/** One row per hint, always in display order: a row never moves when its hint is revealed. */
export function hintRows(hints: RoundHints, victory: boolean): HintRow[] {
  const available = availableHints(hints) > 0;
  return HINT_IDS.map((id) => {
    const label = HINT_LABELS[id];
    const value = hints.values[id];
    const used = hints.used.includes(id);
    if (victory && value !== undefined) return { id, label, kind: used ? "revealed" : "unused", value };
    if (used && value !== undefined) return { id, label, kind: "revealed", value };
    return { id, label, kind: available && !used ? "choice" : "locked" };
  });
}

export interface HintMeter {
  label: string;
  /** The threshold the meter starts from (the previous one, or 0) and the one it runs to. */
  from: number;
  to: number;
  now: number;
}

/** What the card says around its rows, from its counts alone. */
export interface HintCardText {
  /** "1 à choisir" while a hint is waiting; null otherwise (the card shows the counter instead). */
  badge: string | null;
  /** "1 / 3": hints revealed out of all. */
  counter: string;
  intro: string | null;
  meter: HintMeter | null;
  footer: string | null;
  /** The footer is a "found it without a hint" to be proud of. */
  proud: boolean;
}

/** "20", "20 et 35", "20, 35 et 50". */
function listThresholds(thresholds: readonly number[]): string {
  if (thresholds.length < 2) return thresholds.join("");
  return `${thresholds.slice(0, -1).join(", ")} et ${thresholds[thresholds.length - 1]}`;
}

/** The thresholds still to come, as the card's last line words them; null when none is. */
function laterText(later: readonly number[], group: boolean): string | null {
  const suffix = group ? " du groupe" : "";
  if (later.length === 0) return null;
  if (later.length === 1) return `Le dernier à ${later[0]} essais${suffix}.`;
  return `Les suivants à ${later.slice(0, -1).join(", ")} puis ${later[later.length - 1]} essais${suffix}.`;
}

/**
 * The hints card's wording. `group`: the round is a room's, whose guesses all
 * count and whose hints anyone reveals for everyone.
 */
export function hintCardText(hints: RoundHints, { victory, group }: { victory: boolean; group: boolean }): HintCardText {
  const total = HINT_IDS.length;
  const used = hints.used.length;
  const counter = `${used} / ${total}`;
  if (victory) {
    const footer = used === 0 ? "Trouvée sans indice !" : `Trouvée avec ${used} indice${used > 1 ? "s" : ""}.`;
    return { badge: null, counter, intro: null, meter: null, footer, proud: used === 0 };
  }

  const unlocked = unlockedHints(hints.tried);
  const available = availableHints(hints);
  const later = HINT_THRESHOLDS.slice(unlocked);
  if (available > 0) {
    let intro = "Choisis l'indice à révéler.";
    if (group) intro = "Pour tout le groupe : le premier qui choisit le révèle à tous.";
    else if (total - used === 1) intro = "Il reste un dernier indice à révéler.";
    else if (used > 0) intro = "Choisis le deuxième indice.";
    return { badge: `${available} à choisir`, counter, intro, meter: null, footer: laterText(later, group), proud: false };
  }
  if (used >= total) {
    return { badge: null, counter, intro: null, meter: null, footer: "Tous les indices sont révélés.", proud: false };
  }

  const to = HINT_THRESHOLDS[unlocked] as number;
  const meter: HintMeter = {
    label: unlocked === 0 ? "Premier indice" : unlocked === total - 1 ? "Dernier indice" : "Prochain indice",
    from: HINT_THRESHOLDS[unlocked - 1] ?? 0,
    to,
    now: hints.tried,
  };
  const footer =
    unlocked === 0
      ? `Un indice à ${listThresholds(HINT_THRESHOLDS)} essais${group ? " du groupe" : ""} : à chaque fois, ${group ? "le groupe choisit" : "tu choisis"} lequel.`
      : null;
  return { badge: null, counter, intro: null, meter, footer, proud: false };
}

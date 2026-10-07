import type { DisplayLine, DisplaySection, DisplayToken, GuessAnswer, GuessDelta, RevealedSlot, RoundView } from "./types";

/**
 * Applying what a guess changed (GuessDelta) to the round on screen, instead
 * of replacing the round with a whole new one.
 *
 * Only the title, section, line and token a revealed word sits in are copied;
 * every other line keeps its identity, which is what lets a memoized line skip
 * rendering (see TokenRun). A delta only ever reveals words, so applying one
 * twice, or two in either order, comes to the same view. Anything that isn't
 * a reveal comes as a full view instead.
 *
 * Positions are counted as src/game/slots.ts counts them: the title's words,
 * then the lyrics', in reading order.
 */

/** Where a word sits: `section` -1 is the title. */
interface Place {
  section: number;
  line: number;
  token: number;
}

interface Layout {
  /** By position. */
  places: readonly Place[];
}

// A song's layout never changes, so it is worked out once per view loaded in
// full and handed over to every view derived from it. Same for the revealed
// count, kept up to date by applyReveal rather than counted again.
const layouts = new WeakMap<RoundView, Layout>();
const revealedCounts = new WeakMap<RoundView, number>();

function layoutOf(view: RoundView): Layout {
  const cached = layouts.get(view);
  if (cached) return cached;
  const places: Place[] = [];
  const visit = (tokens: readonly DisplayToken[], section: number, line: number) => {
    tokens.forEach((token, index) => {
      if (token.isWord) places.push({ section, line, token: index });
    });
  };
  visit(view.title.tokens, -1, 0);
  view.sections.forEach((section, sectionIndex) =>
    section.lines.forEach((line, lineIndex) => visit(line.tokens, sectionIndex, lineIndex))
  );
  const layout = { places };
  layouts.set(view, layout);
  return layout;
}

/** How many word occurrences `view` shows revealed: what a delta's `revealed` is checked against. */
export function revealedWords(view: RoundView): number {
  const cached = revealedCounts.get(view);
  if (cached !== undefined) return cached;
  let count = 0;
  const visit = (token: DisplayToken) => {
    if (token.isWord && token.revealed) count += 1;
  };
  view.title.tokens.forEach(visit);
  for (const section of view.sections) for (const line of section.lines) line.tokens.forEach(visit);
  revealedCounts.set(view, count);
  return count;
}

/** How many words the round has in all, title included. */
export function wordCount(view: RoundView): number {
  return layoutOf(view).places.length;
}

export function isGuessDelta(answer: GuessAnswer): answer is GuessDelta {
  return "kind" in answer && answer.kind === "delta";
}

/**
 * `view` with every slot of `reveal` revealed, and `state` as its new state.
 * A slot that points at nothing, or at a word already revealed, changes
 * nothing: a delta coming from the network isn't trusted to be well formed.
 */
export function applyReveal(view: RoundView, reveal: readonly RevealedSlot[], state: string): RoundView {
  const layout = layoutOf(view);
  let title: DisplayToken[] | null = null;
  let sections: DisplaySection[] | null = null;
  // Each line copied once, however many of its words the guess reveals.
  const lines = new Map<string, DisplayToken[]>();
  let uncovered = 0;

  for (const slot of reveal) {
    const place = typeof slot.position === "number" ? layout.places[slot.position] : undefined;
    if (!place || typeof slot.text !== "string") continue;
    const current =
      place.section < 0
        ? view.title.tokens[place.token]
        : view.sections[place.section]?.lines[place.line]?.tokens[place.token];
    if (!current || current.revealed) continue;

    const key = `${place.section}:${place.line}`;
    let tokens = lines.get(key);
    if (!tokens) {
      tokens = place.section < 0 ? [...view.title.tokens] : [...(view.sections[place.section]?.lines[place.line]?.tokens ?? [])];
      lines.set(key, tokens);
    }
    // As a full view shows a found word: no hint of any kind left on it.
    tokens[place.token] = { text: slot.text, isWord: true, revealed: true };
    uncovered += 1;
  }

  for (const [key, tokens] of lines) {
    const [section, line] = key.split(":").map(Number) as [number, number];
    if (section < 0) {
      title = tokens;
      continue;
    }
    sections ??= [...view.sections];
    const previous = sections[section] as DisplaySection;
    const original = view.sections[section] as DisplaySection;
    // The section's lines are copied the first time one of them changes.
    const sectionLines: DisplayLine[] = previous.lines === original.lines ? [...original.lines] : previous.lines;
    sectionLines[line] = { tokens };
    sections[section] = { ...original, lines: sectionLines };
  }

  const next: RoundView = {
    ...view,
    state,
    ...(title ? { title: { ...view.title, tokens: title } } : {}),
    ...(sections ? { sections } : {}),
  };
  layouts.set(next, layout);
  revealedCounts.set(next, revealedWords(view) + uncovered);
  return next;
}

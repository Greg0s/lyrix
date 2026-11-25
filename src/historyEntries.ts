/**
 * What the game keeps in each history entry it makes (`history.state`): its
 * place in the session's history, and the nearest round's entry at or below
 * it. The tab bar uses them to go back to « Jouer » rather than add it again
 * (useRoute's navigateTab), so Back from any tab is « Jouer », then out of the
 * app, as in an installed app.
 */
export interface EntryState {
  lyrixIndex: number;
  /** The round's entry (« Jouer »), at or below this one: its place and address. */
  lyrixPlay: { index: number; path: string } | null;
}

function isPlaySlot(value: unknown): value is { index: number; path: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).index === "number" &&
    typeof (value as Record<string, unknown>).path === "string"
  );
}

/** The entry's place, as the game recorded it; an entry it never wrote is the first. */
export function entryOf(state: unknown): EntryState {
  if (typeof state !== "object" || state === null) return { lyrixIndex: 0, lyrixPlay: null };
  const { lyrixIndex, lyrixPlay } = state as Record<string, unknown>;
  return {
    lyrixIndex: typeof lyrixIndex === "number" ? lyrixIndex : 0,
    lyrixPlay: isPlaySlot(lyrixPlay) ? lyrixPlay : null,
  };
}

/** The state of an entry pushed over `below`, for a screen at `path` (a round's if `isPlay`). */
export function pushedEntry(below: unknown, path: string, isPlay: boolean): EntryState {
  const { lyrixIndex, lyrixPlay } = entryOf(below);
  const index = lyrixIndex + 1;
  return { lyrixIndex: index, lyrixPlay: isPlay ? { index, path } : lyrixPlay };
}

/** The state of an entry replacing `replaced`, for a screen at `path`. */
export function replacedEntry(replaced: unknown, path: string, isPlay: boolean): EntryState {
  const { lyrixIndex, lyrixPlay } = entryOf(replaced);
  if (isPlay) return { lyrixIndex, lyrixPlay: { index: lyrixIndex, path } };
  // The round's own entry replaced by another screen: no round below any more.
  return { lyrixIndex, lyrixPlay: lyrixPlay && lyrixPlay.index < lyrixIndex ? lyrixPlay : null };
}

/**
 * How far back the round at `path` is from the entry shown, as `history.go`
 * takes it, or null when it isn't right there to go back to.
 */
export function stepsBackToPlay(state: unknown, path: string): number | null {
  const { lyrixIndex, lyrixPlay } = entryOf(state);
  if (!lyrixPlay || lyrixPlay.path !== path || lyrixPlay.index >= lyrixIndex) return null;
  return lyrixPlay.index - lyrixIndex;
}

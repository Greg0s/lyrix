import { analyzeSong, type AnalyzedToken } from "./analyze";
import type { DisplaySection, DisplayToken, Song } from "./types";

// Masking reads the song's single tokenization pass (see analyze.ts) rather
// than re-tokenizing and re-normalizing every line: the only per-request work
// left here is allocating the DisplayTokens that go on the wire.
function maskToken(
  token: AnalyzedToken,
  foundKeys: ReadonlySet<string>,
  devReveal: boolean,
  revealAll: boolean
): DisplayToken {
  if (!token.isWord) return { text: token.text, isWord: false, revealed: true };
  if (foundKeys.has(token.key)) return { text: token.text, isWord: true, revealed: true };
  const hidden: DisplayToken = { text: token.blank, isWord: true, revealed: false };
  return {
    ...hidden,
    ...(devReveal ? { devHint: token.text } : {}),
    ...(revealAll ? { revealHint: token.text } : {}),
  };
}

function buildTokens(
  tokens: readonly AnalyzedToken[],
  foundKeys: ReadonlySet<string>,
  devReveal: boolean,
  revealAll: boolean
): DisplayToken[] {
  return tokens.map((token) => maskToken(token, foundKeys, devReveal, revealAll));
}

/**
 * `devReveal` attaches every still-hidden word's real text as `devHint` - see
 * DisplayToken and CLAUDE.md's anti-cheat section. `revealAll` does the same
 * as `revealHint`, meant to be passed the round's own (server-verified)
 * `victory` flag, so a won round's "show all lyrics" checkbox has something
 * to display - see DisplayToken.revealHint.
 */
export function buildTitleView(
  song: Song,
  foundKeys: ReadonlySet<string>,
  devReveal = false,
  revealAll = false
): DisplayToken[] {
  return buildTokens(analyzeSong(song).title, foundKeys, devReveal, revealAll);
}

export function buildSectionsView(
  song: Song,
  foundKeys: ReadonlySet<string>,
  devReveal = false,
  revealAll = false
): DisplaySection[] {
  return analyzeSong(song).sections.map((section) => ({
    label: section.label,
    lines: section.lines.map((line) => ({ tokens: buildTokens(line.tokens, foundKeys, devReveal, revealAll) })),
  }));
}

export function titleWordKeys(song: Song): readonly string[] {
  return analyzeSong(song).titleKeys;
}

export function isVictory(song: Song, foundKeys: ReadonlySet<string>): boolean {
  const keys = analyzeSong(song).titleKeys;
  return keys.length > 0 && keys.every((key) => foundKeys.has(key));
}

/** Every normalized word key anywhere in the song (title + all lyric lines). */
export function songWordKeys(song: Song): ReadonlySet<string> {
  return analyzeSong(song).wordKeys;
}

/** Every number in the song, each once (title + all lyric lines). */
export function songNumberKeys(song: Song): readonly string[] {
  return analyzeSong(song).numberKeys;
}

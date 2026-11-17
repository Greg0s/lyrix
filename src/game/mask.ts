import { analyzeSong, type AnalyzedToken } from "./analyze";
import { baseKey, guessKey, elidedGuessKey } from "./normalize";
import type { DisplaySection, DisplayToken, Song } from "./types";

// Masking reads the song's single tokenization pass (see analyze.ts) rather
// than re-tokenizing and re-normalizing every line: the only per-request work
// left here is allocating the DisplayTokens that go on the wire.
/**
 * What a set of found keys reveals: each key's word everywhere, an elided
 * key's ("j'aime") word too ("aime"), plus that key itself, which reveals the
 * elided word only where it is glued to that word.
 */
export function revealedKeys(foundKeys: Iterable<string>): Set<string> {
  const revealed = new Set<string>();
  for (const key of foundKeys) {
    revealed.add(key);
    revealed.add(baseKey(key));
  }
  return revealed;
}

/** Whether a word of the song shows, given what the found keys reveal (revealedKeys). */
export function isTokenRevealed(token: AnalyzedToken, revealed: ReadonlySet<string>): boolean {
  return revealed.has(token.key) || (token.elided !== undefined && revealed.has(token.elided));
}

function maskToken(
  token: AnalyzedToken,
  revealed: ReadonlySet<string>,
  devReveal: boolean,
  revealAll: boolean
): DisplayToken {
  if (!token.isWord) return { text: token.text, isWord: false, revealed: true };
  if (isTokenRevealed(token, revealed)) return { text: token.text, isWord: true, revealed: true };
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
  const revealed = revealedKeys(foundKeys);
  return tokens.map((token) => maskToken(token, revealed, devReveal, revealAll));
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
  const revealed = revealedKeys(foundKeys);
  return analyzeSong(song).sections.map((section) => ({
    label: section.label,
    lines: section.lines.map((line) => ({ tokens: buildTokens(line.tokens, revealed, devReveal, revealAll) })),
  }));
}

export function titleWordKeys(song: Song): readonly string[] {
  return analyzeSong(song).titleKeys;
}

export function isVictory(song: Song, foundKeys: ReadonlySet<string>): boolean {
  const words = analyzeSong(song).title.filter((token) => token.isWord);
  const revealed = revealedKeys(foundKeys);
  return words.length > 0 && words.every((token) => isTokenRevealed(token, revealed));
}

/**
 * The key a guess is found and kept under in this song: its elided key
 * ("j'aime") when the song glues that elision to that word, so the elision
 * is revealed there too; otherwise its plain key ("aime").
 */
export function songGuessKey(song: Song, word: string): string {
  const elided = elidedGuessKey(word);
  return elided !== null && analyzeSong(song).elidedPositions.has(elided) ? elided : guessKey(word);
}

/** Every position a found key reveals: its word's everywhere, and an elided key's elisions. */
export function revealedPositions(song: Song, key: string): number[] {
  const { positions, elidedPositions } = analyzeSong(song);
  return [...(positions.get(baseKey(key)) ?? []), ...(elidedPositions.get(key) ?? [])];
}

/** Every normalized word key anywhere in the song (title + all lyric lines). */
export function songWordKeys(song: Song): ReadonlySet<string> {
  return analyzeSong(song).wordKeys;
}

/** Every number in the song, each once (title + all lyric lines). */
export function songNumberKeys(song: Song): readonly string[] {
  return analyzeSong(song).numberKeys;
}

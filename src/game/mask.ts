import { normalize } from "./normalize";
import { tokenize } from "./tokenize";
import type { DisplaySection, DisplayToken, Song } from "./types";

function maskToken(text: string, isWord: boolean, revealed: boolean): DisplayToken {
  if (!isWord) return { text, isWord, revealed: true };
  return revealed ? { text, isWord, revealed: true } : { text: "_".repeat(text.length), isWord, revealed: false };
}

function buildTokens(text: string, foundKeys: ReadonlySet<string>): DisplayToken[] {
  return tokenize(text).map((token) =>
    maskToken(token.text, token.isWord, token.isWord && foundKeys.has(normalize(token.text)))
  );
}

export function buildTitleView(song: Song, foundKeys: ReadonlySet<string>): DisplayToken[] {
  return buildTokens(song.title, foundKeys);
}

export function buildSectionsView(song: Song, foundKeys: ReadonlySet<string>): DisplaySection[] {
  return song.sections.map((section) => ({
    label: section.label,
    lines: section.lines.map((line) => ({ tokens: buildTokens(line, foundKeys) })),
  }));
}

export function titleWordKeys(song: Song): string[] {
  return tokenize(song.title)
    .filter((token) => token.isWord)
    .map((token) => normalize(token.text));
}

export function isVictory(song: Song, foundKeys: ReadonlySet<string>): boolean {
  const keys = titleWordKeys(song);
  return keys.length > 0 && keys.every((key) => foundKeys.has(key));
}

/** Every normalized word key anywhere in the song (title + all lyric lines). */
export function songWordKeys(song: Song): Set<string> {
  const keys = new Set<string>();
  song.sections.forEach((section) => {
    section.lines.forEach((line) => {
      tokenize(line).forEach((token) => {
        if (token.isWord) keys.add(normalize(token.text));
      });
    });
  });
  titleWordKeys(song).forEach((key) => keys.add(key));
  return keys;
}

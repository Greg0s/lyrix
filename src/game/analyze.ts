import { normalize } from "./normalize";
import { tokenize } from "./tokenize";
import type { Song } from "./types";

/**
 * One tokenization pass per song, reused by everything that walks its text.
 *
 * Serving a single guess used to walk the whole song three times over —
 * songWordKeys() to decide whether the word is in it, buildTitleView() +
 * buildSectionsView() to mask it, wordPositions() to place a close guess — each
 * re-running tokenize() and normalize() on every line. On an 869-word song that
 * measured ~1.5 ms of Worker CPU per guess, two thirds of it redundant.
 *
 * So the walk happens once, here, and everything downstream reads the result.
 * A Song is immutable once resolved (see worker/src/songs.ts), so the analysis
 * is cached against the song object itself: same object, same text, same
 * answer. A WeakMap rather than a keyed cache on purpose — a song re-resolved
 * from LRCLIB with different lyrics is a different object, so it can never pick
 * up a previous version's masking.
 *
 * Pure and framework-agnostic like the rest of src/game: the frontend never
 * holds a Song (it only ever sees masked views), so this is Worker- and
 * script-side only, and tree-shakes out of the browser bundle.
 */

export interface AnalyzedToken {
  text: string;
  isWord: boolean;
  /** `normalize(text)` for a word, `""` for a punctuation run. */
  key: string;
  /** The blank shown while the word is hidden; `""` for a punctuation run. */
  blank: string;
}

export interface AnalyzedLine {
  tokens: AnalyzedToken[];
}

export interface AnalyzedSection {
  label: string;
  lines: AnalyzedLine[];
}

export interface SongAnalysis {
  title: AnalyzedToken[];
  sections: AnalyzedSection[];
  /** Normalized keys of the title's words, in reading order. */
  titleKeys: string[];
  /** Every normalized word key in the song, the title's included. */
  wordKeys: ReadonlySet<string>;
  /**
   * Normalized word -> every position it holds in the round: the index among
   * every word of the song, the title's first, then the lyrics' in reading
   * order. See src/game/slots.ts for what positions are for.
   */
  positions: ReadonlyMap<string, readonly number[]>;
}

const cache = new WeakMap<Song, SongAnalysis>();

function analyzeLine(text: string): AnalyzedToken[] {
  return tokenize(text).map((token) =>
    token.isWord
      ? { text: token.text, isWord: true, key: normalize(token.text), blank: "_".repeat(token.text.length) }
      : { text: token.text, isWord: false, key: "", blank: "" }
  );
}

function analyze(song: Song): SongAnalysis {
  const wordKeys = new Set<string>();
  const positions = new Map<string, number[]>();
  let position = 0;

  const visit = (text: string): AnalyzedToken[] => {
    const tokens = analyzeLine(text);
    for (const token of tokens) {
      if (!token.isWord) continue;
      wordKeys.add(token.key);
      const existing = positions.get(token.key);
      if (existing) existing.push(position);
      else positions.set(token.key, [position]);
      position += 1;
    }
    return tokens;
  };

  // Title first, then the lyrics: the order positions are counted in.
  const title = visit(song.title);
  const sections = song.sections.map((section) => ({
    label: section.label,
    lines: section.lines.map((line) => ({ tokens: visit(line) })),
  }));

  return {
    title,
    sections,
    titleKeys: title.filter((token) => token.isWord).map((token) => token.key),
    wordKeys,
    positions,
  };
}

/** The analysis of `song`, computed once and reused for the object's lifetime. */
export function analyzeSong(song: Song): SongAnalysis {
  const cached = cache.get(song);
  if (cached) return cached;
  const analysis = analyze(song);
  cache.set(song, analysis);
  return analysis;
}

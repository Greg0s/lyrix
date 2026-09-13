export interface Section {
  label: string;
  lines: string[];
}

/** Secret, server-only shape. Never import this into frontend code. */
export interface Song {
  id: string;
  title: string;
  artist: string;
  sections: Section[];
}

export interface Token {
  text: string;
  isWord: boolean;
}

export interface DisplayToken {
  text: string;
  isWord: boolean;
  revealed: boolean;
}

export interface DisplayLine {
  tokens: DisplayToken[];
}

export interface DisplaySection {
  label: string;
  lines: DisplayLine[];
}

/** Wire contract shared by the Worker (producer) and the frontend (consumer). */
export interface RoundView {
  songId: string;
  state: string;
  title: { tokens: DisplayToken[] };
  sections: DisplaySection[];
  victory: boolean;
  /** Only ever present once `victory` is true. */
  artist?: string;
}

/**
 * A hidden word a missed guess is semantically close to, so the frontend can
 * show the guess in its place. Addressed by position only, never by the word
 * it hides — see src/game/slots.ts for how positions are counted.
 */
export interface NearSlot {
  /** Index of the word among every word of the round: the title's first, then the lyrics' in reading order. */
  position: number;
  /** How close the guess is to the word hidden there, 0-100. */
  score: number;
}

export interface GuessResult extends RoundView {
  found: boolean;
  key: string;
  /**
   * Semantic proximity of the guess to the song, 0-100 (see src/game/similarity.ts).
   * `null` when the word is outside the reference vocabulary or no similarity
   * table is available for this song. Deliberately just a number: the closest
   * target word and its vector never leave the Worker.
   */
  score: number | null;
  /**
   * Every still-hidden word the guess is close to (at least NEAR_SCORE), one
   * entry per occurrence. Empty for a found word, an unscored one, or one that
   * is close to nothing. Positions and numbers only: the words stay on the Worker.
   */
  near: NearSlot[];
}

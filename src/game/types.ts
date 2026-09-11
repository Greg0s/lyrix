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

export interface GuessResult extends RoundView {
  found: boolean;
  key: string;
}

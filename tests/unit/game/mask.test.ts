import { describe, expect, it } from "vitest";
import {
  buildSectionsView,
  buildTitleView,
  isVictory,
  songNumberKeys,
  songWordKeys,
  titleWordKeys,
} from "../../../src/game/mask";
import type { Song } from "../../../src/game/types";

const song: Song = {
  id: "test-song",
  title: "L'été bleu",
  artist: "Test Artist",
  sections: [{ label: "Couplet 1", lines: ["Le ciel est bleu, l'été chante."] }],
};

describe("buildTitleView", () => {
  it("masks unfound words and reveals found ones", () => {
    const view = buildTitleView(song, new Set(["ete"]));
    const words = view.filter((t) => t.isWord);
    // Title "L'été bleu" tokenizes to word keys: l, ete, bleu.
    expect(words.map((t) => t.revealed)).toEqual([false, true, false]);
    expect(words[0].text).toBe("_");
    expect(words[1].text).toBe("été");
    expect(words[2].text).toBe("____");
  });

  it("always reveals punctuation tokens", () => {
    const view = buildTitleView(song, new Set());
    expect(view.filter((t) => !t.isWord).every((t) => t.revealed)).toBe(true);
  });
});

describe("titleWordKeys / isVictory", () => {
  it("lists normalized word keys from the title", () => {
    expect(titleWordKeys(song)).toEqual(["l", "ete", "bleu"]);
  });

  it("is not victorious until every title word is found", () => {
    expect(isVictory(song, new Set(["l", "ete"]))).toBe(false);
    expect(isVictory(song, new Set(["l", "ete", "bleu"]))).toBe(true);
  });

  it("is never victorious for a title with no words", () => {
    const noWordTitle: Song = { ...song, title: "..." };
    expect(isVictory(noWordTitle, new Set())).toBe(false);
  });
});

describe("songWordKeys", () => {
  it("collects normalized keys from lyrics and title", () => {
    const keys = songWordKeys(song);
    expect(keys.has("ciel")).toBe(true);
    expect(keys.has("chante")).toBe(true);
    expect(keys.has("bleu")).toBe(true);
    expect(keys.has("ete")).toBe(true);
  });
});

describe("numbers", () => {
  const counted: Song = { ...song, title: "Les 90 ans", sections: [{ label: "Couplet 1", lines: ["Née en 1975"] }] };

  it("hides a number like any other word, at its own length", () => {
    const words = buildSectionsView(counted, new Set())[0].lines[0].tokens.filter((t) => t.isWord);
    expect(words.map((t) => t.text)).toEqual(["___", "__", "____"]);
  });

  it("makes it a word of the song, found by guessing it", () => {
    expect(songWordKeys(counted).has("1975")).toBe(true);
    expect(songNumberKeys(counted)).toEqual(["90", "1975"]);
    const words = buildSectionsView(counted, new Set(["1975"]))[0].lines[0].tokens.filter((t) => t.isWord);
    expect(words.map((t) => t.text)).toEqual(["___", "__", "1975"]);
  });
});

describe("buildSectionsView", () => {
  it("preserves section labels and line structure", () => {
    const view = buildSectionsView(song, new Set());
    expect(view).toHaveLength(1);
    expect(view[0].label).toBe("Couplet 1");
    expect(view[0].lines).toHaveLength(1);
  });
});

describe("devReveal", () => {
  it("attaches no devHint by default", () => {
    const title = buildTitleView(song, new Set());
    const lyrics = buildSectionsView(song, new Set());
    expect(title.every((t) => t.devHint === undefined)).toBe(true);
    expect(lyrics[0].lines[0].tokens.every((t) => t.devHint === undefined)).toBe(true);
  });

  it("attaches the real text of every still-hidden word when on", () => {
    const view = buildTitleView(song, new Set(["ete"]), true);
    const words = view.filter((t) => t.isWord);
    // "L'été bleu" -> L, ete, bleu (raw case preserved, like `text`); "ete" is found, the other two stay hidden.
    expect(words.map((t) => t.devHint)).toEqual(["L", undefined, "bleu"]);
  });

  it("never attaches devHint to an already-revealed word or to punctuation", () => {
    const view = buildTitleView(song, new Set(["l", "ete", "bleu"]), true);
    expect(view.every((t) => t.devHint === undefined)).toBe(true);
  });

  it("reveals hidden lyrics words the same way", () => {
    const view = buildSectionsView(song, new Set(), true);
    const words = view[0].lines[0].tokens.filter((t) => t.isWord);
    expect(words.every((t) => typeof t.devHint === "string" && t.devHint.length > 0)).toBe(true);
  });
});

describe("revealAll (post-victory 'show all lyrics' checkbox)", () => {
  it("attaches no revealHint by default", () => {
    const title = buildTitleView(song, new Set());
    const lyrics = buildSectionsView(song, new Set());
    expect(title.every((t) => t.revealHint === undefined)).toBe(true);
    expect(lyrics[0].lines[0].tokens.every((t) => t.revealHint === undefined)).toBe(true);
  });

  it("attaches the real text of every still-hidden lyrics word when on", () => {
    const view = buildSectionsView(song, new Set(), false, true);
    const words = view[0].lines[0].tokens.filter((t) => t.isWord);
    expect(words.every((t) => typeof t.revealHint === "string" && t.revealHint.length > 0)).toBe(true);
  });

  it("never attaches revealHint to an already-revealed word or to punctuation", () => {
    const view = buildSectionsView(song, new Set(["le", "ciel", "est", "bleu", "l", "ete", "chante"]), false, true);
    expect(view[0].lines[0].tokens.every((t) => t.revealHint === undefined)).toBe(true);
  });

  it("is independent from devReveal - either flag, or both, can be on at once", () => {
    const view = buildTitleView(song, new Set(["ete"]), true, true);
    const words = view.filter((t) => t.isWord);
    expect(words.map((t) => t.devHint)).toEqual(["L", undefined, "bleu"]);
    expect(words.map((t) => t.revealHint)).toEqual(["L", undefined, "bleu"]);
  });
});

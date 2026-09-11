import { describe, expect, it } from "vitest";
import { buildSectionsView, buildTitleView, isVictory, songWordKeys, titleWordKeys } from "../../../src/game/mask";
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

describe("buildSectionsView", () => {
  it("preserves section labels and line structure", () => {
    const view = buildSectionsView(song, new Set());
    expect(view).toHaveLength(1);
    expect(view[0].label).toBe("Couplet 1");
    expect(view[0].lines).toHaveLength(1);
  });
});

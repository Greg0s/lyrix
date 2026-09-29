import { describe, expect, it } from "vitest";
import { revealedPercent } from "../../../src/game/progress";
import type { DisplayToken } from "../../../src/game/types";

const word = (text: string, revealed: boolean): DisplayToken => ({ text, isWord: true, revealed });
const space: DisplayToken = { text: " ", isWord: false, revealed: true };

describe("revealedPercent", () => {
  it("counts every word occurrence of the title and the lyrics, never the punctuation", () => {
    const round = {
      title: { tokens: [word("Le", true), space, word("______", false)] },
      sections: [{ label: "Refrain", lines: [{ tokens: [word("le", true), space, word("____", false)] }] }],
    };
    expect(revealedPercent(round)).toBe(50);
  });

  it("rounds down, so 100 means every word is out", () => {
    const round = {
      title: { tokens: [word("a", true), word("b", true), word("c", false)] },
      sections: [],
    };
    expect(revealedPercent(round)).toBe(66);
  });

  it("is 0 for a round with no word at all", () => {
    expect(revealedPercent({ title: { tokens: [] }, sections: [] })).toBe(0);
  });
});

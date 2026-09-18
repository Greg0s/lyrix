import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "../../../src/game/types";

// Wraps the real tokenizer in a spy, so the tests below can assert how many
// times the song's text is actually walked - the whole point of analyze.ts.
const tokenizeSpy = vi.hoisted(() => vi.fn());
vi.mock("../../../src/game/tokenize", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/game/tokenize")>();
  tokenizeSpy.mockImplementation(actual.tokenize);
  return { ...actual, tokenize: tokenizeSpy };
});

const { analyzeSong } = await import("../../../src/game/analyze");
const { buildSectionsView, buildTitleView, isVictory, songWordKeys, titleWordKeys } = await import(
  "../../../src/game/mask"
);
const { wordPositions } = await import("../../../src/game/slots");
const { normalize } = await import("../../../src/game/normalize");
const { tokenize } = await import("../../../src/game/tokenize");

function song(): Song {
  return {
    id: "orage-fixture",
    title: "L'été bleu",
    artist: "Fixture",
    sections: [
      { label: "Couplet 1", lines: ["La pluie et l'orage", "Encore la pluie"] },
      { label: "Refrain", lines: ["Bleu, bleu, l'été"] },
    ],
  };
}

/** The naive walk the analysis replaced: every line tokenized and normalized on the spot. */
function naiveWalk(target: Song): { keys: string[]; positions: Map<string, number[]> } {
  const keys: string[] = [];
  const positions = new Map<string, number[]>();
  const visit = (text: string) => {
    for (const token of tokenize(text)) {
      if (!token.isWord) continue;
      const key = normalize(token.text);
      keys.push(key);
      positions.set(key, [...(positions.get(key) ?? []), keys.length - 1]);
    }
  };
  visit(target.title);
  target.sections.forEach((section) => section.lines.forEach((line) => visit(line)));
  return { keys, positions };
}

beforeEach(() => {
  tokenizeSpy.mockClear();
});

describe("analyzeSong", () => {
  it("counts positions and keys exactly like walking the song by hand", () => {
    const fixture = song();
    const expected = naiveWalk(fixture);
    const analysis = analyzeSong(fixture);

    expect([...analysis.positions.entries()].map(([key, at]) => [key, [...at]])).toEqual([...expected.positions]);
    expect([...analysis.wordKeys].sort()).toEqual([...new Set(expected.keys)].sort());
    expect(analysis.titleKeys).toEqual(["l", "ete", "bleu"]);
  });

  it("lists the song's numbers once each, in reading order", () => {
    const counted: Song = {
      ...song(),
      title: "Les 90 ans",
      sections: [{ label: "Couplet 1", lines: ["En 2015 puis en 90", "Et 007"] }],
    };
    expect(analyzeSong(counted).numberKeys).toEqual(["90", "2015", "007"]);
    expect(analyzeSong(song()).numberKeys).toEqual([]);
  });

  it("precomputes each hidden word's blank at its own length", () => {
    const analysis = analyzeSong(song());
    const word = analysis.title.find((token) => token.text === "été");
    expect(word?.blank).toBe("___");
    expect(analysis.title.find((token) => !token.isWord)?.blank).toBe("");
  });

  it("walks a song once, however many times it is analyzed", () => {
    const fixture = song();
    analyzeSong(fixture);
    const afterFirst = tokenizeSpy.mock.calls.length;
    analyzeSong(fixture);
    analyzeSong(fixture);

    // One call per line of text: the title plus the three lyric lines.
    expect(afterFirst).toBe(4);
    expect(tokenizeSpy.mock.calls.length).toBe(afterFirst);
  });

  it("never reuses one song's analysis for another object, even under the same id", () => {
    const original = song();
    const rewritten: Song = { ...original, title: "Un autre titre" };
    expect(rewritten.id).toBe(original.id);

    expect(analyzeSong(original).titleKeys).toEqual(["l", "ete", "bleu"]);
    expect(analyzeSong(rewritten).titleKeys).toEqual(["un", "autre", "titre"]);
  });
});

describe("the per-guess path", () => {
  // Regression test for the optimization: serving one guess used to walk the
  // whole song three times over (membership, masking, placement), each run
  // re-tokenizing and re-normalizing every line. It measured ~1.5 ms of Worker
  // CPU on an 869-word song; now the walk happens once and the rest reads it.
  it("walks the song once for membership, masking and placement together", () => {
    const fixture = song();
    const found = new Set(["ete"]);

    songWordKeys(fixture).has("pluie");
    buildTitleView(fixture, found);
    buildSectionsView(fixture, found);
    wordPositions(fixture);
    titleWordKeys(fixture);
    isVictory(fixture, found);

    expect(tokenizeSpy.mock.calls.length).toBe(4);
  });

  it("walks it no further on a second guess for the same song", () => {
    const fixture = song();
    songWordKeys(fixture);
    buildSectionsView(fixture, new Set());
    const afterFirstGuess = tokenizeSpy.mock.calls.length;

    songWordKeys(fixture);
    buildSectionsView(fixture, new Set(["pluie"]));
    wordPositions(fixture);

    expect(tokenizeSpy.mock.calls.length).toBe(afterFirstGuess);
  });

  it("still masks correctly when the analysis is reused across guesses", () => {
    const fixture = song();
    const first = buildSectionsView(fixture, new Set());
    const second = buildSectionsView(fixture, new Set(["pluie"]));

    const textOf = (view: ReturnType<typeof buildSectionsView>) =>
      view[0].lines[0].tokens.map((token) => token.text).join("");
    expect(textOf(first)).toBe("__ _____ __ _'_____");
    expect(textOf(second)).toBe("__ pluie __ _'_____");
  });
});

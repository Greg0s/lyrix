import { describe, expect, it } from "vitest";
import { isNumberWord, tokenize } from "../../../src/game/tokenize";

describe("tokenize", () => {
  it("splits words from surrounding punctuation", () => {
    const tokens = tokenize("Bonjour, le monde !");
    expect(tokens.map((t) => t.text)).toEqual(["Bonjour", ", ", "le", " ", "monde", " !"]);
    expect(tokens.map((t) => t.isWord)).toEqual([true, false, true, false, true, false]);
  });

  it("separates elided words so the root word is independently guessable", () => {
    const tokens = tokenize("l'amour");
    expect(tokens.map((t) => t.text)).toEqual(["l", "'", "amour"]);
    expect(tokens.map((t) => t.isWord)).toEqual([true, false, true]);
  });

  it("keeps accented letters as part of a word", () => {
    const tokens = tokenize("l'été");
    expect(tokens.map((t) => t.text)).toEqual(["l", "'", "été"]);
  });

  it("returns nothing for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });

  // Regression test: œ isn't a Latin-1 letter, so "cœur" used to come out as
  // "c", "œ", "ur" - two words that aren't "cœur", and a word no guess could find.
  it("keeps œ inside the word it belongs to", () => {
    expect(tokenize("mon cœur").map((t) => [t.text, t.isWord])).toEqual([
      ["mon", true],
      [" ", false],
      ["cœur", true],
    ]);
    expect(
      tokenize("Œil pour œil")
        .filter((t) => t.isWord)
        .map((t) => t.text)
    ).toEqual(["Œil", "pour", "œil"]);
  });

  it("makes a word of a number, kept apart from any letters next to it", () => {
    expect(
      tokenize("En 2015, les 90s")
        .filter((t) => t.isWord)
        .map((t) => t.text)
    ).toEqual(["En", "2015", "les", "90", "s"]);
  });
});

describe("isNumberWord", () => {
  it("recognises a run of digits and nothing else", () => {
    expect(isNumberWord("2015")).toBe(true);
    expect(isNumberWord("007")).toBe(true);
    expect(isNumberWord("90s")).toBe(false);
    expect(isNumberWord("deux")).toBe(false);
    expect(isNumberWord("")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { tokenize } from "../../../src/game/tokenize";

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
});

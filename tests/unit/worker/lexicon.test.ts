import { describe, expect, it } from "vitest";
import { guessKey } from "../../../src/game/normalize";
import { inLexicon, isKnownWord } from "../../../worker/src/lexicon";

describe("inLexicon", () => {
  const small = "\nabricot\nbanane\ncerise\n";

  it("finds every word of a lexicon, the first and the last included", () => {
    for (const word of ["abricot", "banane", "cerise"]) expect(inLexicon(word, small)).toBe(true);
  });

  it("finds no word that isn't one, before, between or after them, nor a part of one", () => {
    for (const word of ["a", "abri", "abricots", "b", "bananes", "zebre", "", "banane\ncerise"]) {
      expect(inLexicon(word, small)).toBe(false);
    }
    expect(inLexicon("abricot", "\n")).toBe(false);
  });

  it("knows French words in all their forms, as a guess is keyed", () => {
    for (const typed of ["Chanter", "chantâmes", "aimerions", "chevaux", "Élégantes", "cœur", "aujourd’hui", "l'amour", "week-end"]) {
      expect(inLexicon(guessKey(typed)), typed).toBe(true);
    }
  });

  it("knows the familiar words, names and English songs use", () => {
    for (const typed of ["meuf", "kiffer", "wesh", "ok", "Marseille", "Juliette", "yeah", "baby"]) {
      expect(inLexicon(guessKey(typed)), typed).toBe(true);
    }
  });

  it("doesn't know what is no word", () => {
    for (const typed of ["azertyuiop", "xylophoneinexistant", "chantert", "zzqxw", "a b"]) {
      expect(inLexicon(guessKey(typed)), typed).toBe(false);
    }
  });
});

describe("isKnownWord", () => {
  const table = { scores: { pikachu: 12 } };

  it("knows a number, a word of the lexicon, and a word the song's table scores", () => {
    expect(isKnownWord("2015", null)).toBe(true);
    expect(isKnownWord("orage", null)).toBe(true);
    expect(isKnownWord("pikachu", table)).toBe(true);
    expect(isKnownWord("pikachu", null)).toBe(false);
    expect(isKnownWord("azertyuiop", table)).toBe(false);
  });

  it("refuses nothing while the table couldn't be read: an outage is no refusal", () => {
    expect(isKnownWord("azertyuiop", undefined)).toBe(true);
  });
});

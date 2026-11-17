import { describe, expect, it } from "vitest";
import { baseKey, elidedGuessKey, guessKey, normalize } from "../../../src/game/normalize";

describe("normalize", () => {
  it("lowercases input", () => {
    expect(normalize("BONJOUR")).toBe("bonjour");
  });

  it("strips accents", () => {
    expect(normalize("à")).toBe("a");
    expect(normalize("é")).toBe("e");
    expect(normalize("où")).toBe("ou");
    expect(normalize("Anaïs")).toBe("anais");
  });

  it("treats accented and unaccented guesses as equal", () => {
    expect(normalize("Étoile")).toBe(normalize("etoile"));
  });

  // Regression test, with tokenize.test.ts's: lyrics spell "cœur" or "coeur"
  // depending on who typed them, and the embedding model only knows "coeur".
  it("spells out the œ and æ ligatures", () => {
    expect(normalize("Cœur")).toBe("coeur");
    expect(normalize("cœur")).toBe(normalize("coeur"));
    expect(normalize("Œil")).toBe("oeil");
    expect(normalize("Lætitia")).toBe("laetitia");
  });
});

describe("guessKey", () => {
  it("drops an elided word in front, whatever the apostrophe", () => {
    expect(guessKey("l'amour")).toBe("amour");
    expect(guessKey("J’aime")).toBe("aime");
    expect(guessKey("qu'il")).toBe("il");
    expect(guessKey("jusqu'à")).toBe("a");
  });

  it("drops the punctuation typed around a word", () => {
    expect(guessKey("amour !")).toBe("amour");
    expect(guessKey("« Cœur »")).toBe("coeur");
  });

  it("keeps a word that only looks like an elision, and the elided letter alone", () => {
    expect(guessKey("aujourd'hui")).toBe("aujourd'hui");
    expect(guessKey("l")).toBe("l");
    expect(guessKey("l'")).toBe("l");
  });
});

describe("elidedGuessKey", () => {
  it("keeps the elision of a guess, with a plain apostrophe", () => {
    expect(elidedGuessKey("J’aime !")).toBe("j'aime");
    expect(elidedGuessKey("qu'il")).toBe("qu'il");
    expect(elidedGuessKey("L'Amour")).toBe("l'amour");
  });

  it("has none for a word without an elision", () => {
    expect(elidedGuessKey("aime")).toBeNull();
    expect(elidedGuessKey("aujourd'hui")).toBeNull();
  });
});

describe("baseKey", () => {
  it("drops an elision, and only an elision", () => {
    expect(baseKey("j'aime")).toBe("aime");
    expect(baseKey("qu'il")).toBe("il");
    expect(baseKey("aime")).toBe("aime");
    expect(baseKey("aujourd'hui")).toBe("aujourd'hui");
  });
});

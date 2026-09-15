import { describe, expect, it } from "vitest";
import { FUNCTION_WORDS, isFunctionWord } from "../../../src/game/functionWords";
import { normalize } from "../../../src/game/normalize";
import { tokenize } from "../../../src/game/tokenize";

describe("FUNCTION_WORDS", () => {
  it("only holds normalized keys, so a lookup matches a song word or a guess", () => {
    for (const word of FUNCTION_WORDS) expect(normalize(word)).toBe(word);
  });

  it("covers the elided forms the tokenizer splits off", () => {
    const keys = tokenize("j'ai l'amour qu'il n'a d'autre c'est jusqu'au lorsqu'il")
      .filter((token) => token.isWord)
      .map((token) => normalize(token.text));
    for (const elided of ["j", "l", "qu", "n", "d", "c", "jusqu", "lorsqu"]) {
      expect(keys).toContain(elided);
      expect(isFunctionWord(elided)).toBe(true);
    }
  });

  it("leaves out words that mean something in a song, homographs included", () => {
    for (const key of ["amour", "toujours", "jamais", "rien", "bien", "demain", "vie", "ete", "or"]) {
      expect(isFunctionWord(key)).toBe(false);
    }
  });
});

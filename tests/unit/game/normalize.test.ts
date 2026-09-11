import { describe, expect, it } from "vitest";
import { normalize } from "../../../src/game/normalize";

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
});

import { describe, expect, it } from "vitest";
import { isFunctionWord } from "../../../src/game/functionWords";
import { normalize } from "../../../src/game/normalize";
import { tokenize } from "../../../src/game/tokenize";
import { catalog } from "../../../worker/src/catalog";
import { artistTypeText, decadeText, hintValues, SONG_FACTS } from "../../../worker/src/songFacts";

/** The words of a text that mean something: normalized, function words aside. */
function meaningfulWords(text: string): Set<string> {
  return new Set(
    tokenize(text)
      .filter((token) => token.isWord)
      .map((token) => normalize(token.text))
      .filter((key) => !isFunctionWord(key))
  );
}

describe("song facts", () => {
  it("cover every song of the catalog", () => {
    const missing = catalog.filter((entry) => !(entry.id in SONG_FACTS)).map((entry) => entry.id);
    expect(missing).toEqual([]);
  });

  it("give no hint a word of its song's title or artist", () => {
    const leaks = catalog.flatMap((entry) => {
      const values = hintValues(entry.id) ?? {};
      const secret = meaningfulWords(`${entry.title} ${entry.artist}`);
      return Object.values(values).flatMap((text) =>
        [...meaningfulWords(text)].filter((word) => secret.has(word)).map((word) => `${entry.id}: ${word}`)
      );
    });
    expect(leaks).toEqual([]);
  });

  it("have no hints for a song they don't know", () => {
    expect(hintValues("not-a-song")).toBeNull();
    expect(hintValues("__proto__")).toBeNull();
  });
});

describe("hint texts", () => {
  it("name a decade as French does", () => {
    expect(decadeText(1947)).toBe("Années 40");
    expect(decadeText(1960)).toBe("Années 60");
    expect(decadeText(1989)).toBe("Années 80");
    expect(decadeText(2000)).toBe("Années 2000");
    expect(decadeText(2013)).toBe("Années 2010");
    expect(decadeText(2024)).toBe("Années 2020");
  });

  it("say solo or group, gender and country, with the adjective agreeing", () => {
    expect(artistTypeText({ artist: "man", origin: "fr" })).toBe("Un artiste français");
    expect(artistTypeText({ artist: "woman", origin: "fr" })).toBe("Une artiste française");
    expect(artistTypeText({ artist: "woman", origin: "qc" })).toBe("Une artiste québécoise");
    expect(artistTypeText({ artist: "man", origin: "be" })).toBe("Un artiste belge");
    expect(artistTypeText({ artist: "group", origin: "fr" })).toBe("Un groupe français");
    expect(artistTypeText({ artist: "duo", origin: "fr" })).toBe("Un duo français");
  });
});

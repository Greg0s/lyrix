import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEXICON_MODULE, lexiconKeys, lexiconSource, parseExtraWords } from "../../../scripts/build-lexicon";

describe("the lexicon", () => {
  it("is embedded in the Worker in step with its sources (npm run lexicon:build)", () => {
    const written = readFileSync(LEXICON_MODULE, "utf8").replace(/\r\n/g, "\n");
    expect(written === lexiconSource()).toBe(true);
  });

  it("reads the curated words one per line, comments and blank lines left out", () => {
    expect(parseExtraWords("# a comment\r\nmeuf\n\n  wesh  \n#kiffer\n")).toEqual(["meuf", "wesh"]);
  });

  it("holds every word normalized, each once, sorted as a binary search compares them", () => {
    const keys = lexiconKeys(["Été", "œuvre", "ete", "zèbre", "abricot"]);
    expect(keys).toEqual(["abricot", "ete", "oeuvre", "zebre"]);
  });

  it("knows each part of a word the lyrics split, and writes apostrophes plainly", () => {
    expect(lexiconKeys(["Aujourd’hui", "rendez-vous"])).toEqual(["aujourd", "aujourd'hui", "hui", "rendez", "rendez-vous", "vous"]);
  });
});

import { describe, expect, it } from "vitest";
import { graphemes, PSEUDO_MAX_LENGTH, sanitizePseudo } from "../../../src/game/room";
import { FEMALE_SINGERS, MALE_SINGERS, pickSingerName } from "../../../worker/src/singerNames";

describe("the singers' names", () => {
  it("lists 50 men and 50 women, none twice", () => {
    expect(MALE_SINGERS).toHaveLength(50);
    expect(FEMALE_SINGERS).toHaveLength(50);
    const all = [...MALE_SINGERS, ...FEMALE_SINGERS].map((name) => name.toLowerCase());
    expect(new Set(all).size).toBe(100);
  });

  it("are all names a pseudo can be: sanitizing changes none, none is too long", () => {
    for (const name of [...MALE_SINGERS, ...FEMALE_SINGERS]) {
      expect(sanitizePseudo(name)).toBe(name);
      expect(graphemes(name).length).toBeLessThanOrEqual(PSEUDO_MAX_LENGTH);
    }
  });
});

describe("pickSingerName", () => {
  const everyone = [...MALE_SINGERS, ...FEMALE_SINGERS];

  it("draws a singer of either list", () => {
    expect(everyone).toContain(pickSingerName([]));
  });

  it("never draws a name already taken, whatever its case", () => {
    const taken = everyone.slice(1).map((name, index) => (index % 2 ? name.toUpperCase() : name));
    for (let draw = 0; draw < 20; draw++) expect(pickSingerName(taken)).toBe(everyone[0]);
  });

  it("draws no one once every name is taken", () => {
    expect(pickSingerName(everyone)).toBeNull();
  });

  it("ignores members without a name", () => {
    expect(everyone).toContain(pickSingerName([null, null]));
  });
});

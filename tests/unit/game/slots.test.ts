import { describe, expect, it } from "vitest";
import { buildSectionsView, buildTitleView, songWordKeys } from "../../../src/game/mask";
import { normalize } from "../../../src/game/normalize";
import {
  closestGuessBySlot,
  parseNearSlots,
  placeNearGuesses,
  wordPositions,
  type NearGuess,
  type PlacedGuess,
  type SlotToken,
  type SlotView,
} from "../../../src/game/slots";
import type { Song } from "../../../src/game/types";

const song: Song = {
  id: "test-song",
  title: "L'été bleu",
  artist: "Test Artist",
  sections: [
    { label: "Couplet 1", lines: ["Le ciel est bleu, l'été chante.", "Bleu comme la mer"] },
    { label: "Refrain", lines: ["Chante, chante encore"] },
  ],
};

function maskedRound(foundKeys: Iterable<string> = []) {
  const found = new Set(foundKeys);
  return { title: { tokens: buildTitleView(song, found) }, sections: buildSectionsView(song, found) };
}

function allTokens(view: SlotView): SlotToken[] {
  return [...view.title, ...view.sections.flatMap((section) => section.lines.flatMap((line) => line.tokens))];
}

/** Every word token of a placed view, in reading order: title, then lyrics. */
function wordsOf(view: SlotView): SlotToken[] {
  return allTokens(view).filter((token) => token.isWord);
}

function guessOn(positions: readonly number[], guess: NearGuess): Map<number, NearGuess> {
  return new Map(positions.map((position) => [position, guess]));
}

describe("wordPositions", () => {
  it("counts the title's words first, then the lyrics in reading order", () => {
    const positions = wordPositions(song);
    // L'été bleu | Le ciel est bleu, l'été chante. | Bleu comme la mer | Chante, chante encore
    //  0  1   2  |  3   4   5    6   7  8     9     |  10   11  12  13  |   14      15     16
    expect(positions.get("l")).toEqual([0, 7]);
    expect(positions.get("bleu")).toEqual([2, 6, 10]);
    expect(positions.get("chante")).toEqual([9, 14, 15]);
    expect(positions.get("encore")).toEqual([16]);
  });

  it("keys words the way a guess is normalized", () => {
    const positions = wordPositions(song);
    expect(positions.get("ete")).toEqual([1, 8]);
    expect(positions.has("été")).toBe(false);
  });

  it("covers exactly the words of the song", () => {
    expect([...wordPositions(song).keys()].sort()).toEqual([...songWordKeys(song)].sort());
  });
});

describe("placeNearGuesses", () => {
  // The two halves of the addressing contract, run against each other: for
  // every word of the song, the Worker's positions laid onto the masked view
  // must cover exactly the words that read that way once revealed.
  it("lands on the very words the Worker pointed at", () => {
    const revealed = wordsOf(placeNearGuesses(maskedRound(songWordKeys(song)), new Map()));

    for (const [key, positions] of wordPositions(song)) {
      const placed = wordsOf(placeNearGuesses(maskedRound(), guessOn(positions, { text: "azur", score: 64 })));
      const landedOn = placed.flatMap((token, index) => (token.near ? [normalize(revealed[index].text)] : []));
      expect(landedOn).toEqual(positions.map(() => key));
    }
  });

  it("shows the guess and its score on a still-masked word", () => {
    const placed = wordsOf(placeNearGuesses(maskedRound(), guessOn([4], { text: "azur", score: 64 })));
    expect(placed[4]).toEqual({ text: "____", isWord: true, revealed: false, near: { text: "azur", score: 64 } });
  });

  it("never covers a word that is already revealed", () => {
    const bleu = wordPositions(song).get("bleu") ?? [];
    const placed = wordsOf(placeNearGuesses(maskedRound(["bleu"]), guessOn(bleu, { text: "azur", score: 64 })));
    for (const position of bleu) {
      expect(placed[position].near).toBeUndefined();
      expect(normalize(placed[position].text)).toBe("bleu");
    }
  });

  it("leaves punctuation and the words nobody came close to untouched", () => {
    const round = maskedRound();
    const tokens = allTokens(placeNearGuesses(round, guessOn([4], { text: "azur", score: 64 })));
    const original = [...round.title.tokens, ...round.sections.flatMap((s) => s.lines.flatMap((l) => l.tokens))];

    expect(tokens.filter((token) => token.near)).toHaveLength(1);
    expect(tokens.map(({ text, isWord, revealed }) => ({ text, isWord, revealed }))).toEqual(original);
  });

  it("ignores a position past the last word of the round", () => {
    const view = placeNearGuesses(maskedRound(), guessOn([17, 999], { text: "azur", score: 64 }));
    expect(wordsOf(view).some((token) => token.near)).toBe(false);
  });

  it("keeps the sections' labels and lines", () => {
    const view = placeNearGuesses(maskedRound(), new Map());
    expect(view.sections.map((section) => [section.label, section.lines.length])).toEqual([
      ["Couplet 1", 2],
      ["Refrain", 1],
    ]);
  });
});

describe("placeNearGuesses, given its previous call", () => {
  // Positions: the title's 0-2, the first verse line's 3-9, the second's 10-13, the chorus's 14-16.
  function placedTwice(first: Map<number, NearGuess>, second: Map<number, NearGuess>, round = maskedRound()) {
    const before = placeNearGuesses(round, first);
    const after = placeNearGuesses(round, second, { round, bySlot: first, view: before });
    return { before, after };
  }

  it("hands back the very same view when nothing changed", () => {
    const { before, after } = placedTwice(guessOn([4], { text: "azur", score: 64 }), guessOn([4], { text: "azur", score: 64 }));
    expect(after.title).toBe(before.title);
    expect(after.sections).toBe(before.sections);
  });

  it("replaces only the line a closest guess changed on", () => {
    const { before, after } = placedTwice(new Map(), guessOn([11], { text: "azur", score: 64 }));
    expect(after.title).toBe(before.title);
    expect(after.sections[0]?.lines[0]).toBe(before.sections[0]?.lines[0]);
    expect(after.sections[0]?.lines[1]).not.toBe(before.sections[0]?.lines[1]);
    expect(after.sections[1]).toBe(before.sections[1]);
    expect(wordsOf(after)[11]?.near).toEqual({ text: "azur", score: 64 });
  });

  it("replaces the line a closest guess leaves", () => {
    const { before, after } = placedTwice(guessOn([15], { text: "azur", score: 64 }), new Map());
    expect(after.sections[1]).not.toBe(before.sections[1]);
    expect(wordsOf(after)[15]?.near).toBeUndefined();
    expect(after.sections[0]).toBe(before.sections[0]);
  });

  it("reuses nothing of a round whose lines are new arrays", () => {
    const round = maskedRound();
    const before = placeNearGuesses(round, new Map());
    const after = placeNearGuesses(maskedRound(), new Map(), { round, bySlot: new Map(), view: before });
    expect(after.title).not.toBe(before.title);
    expect(after.sections[0]?.lines[0]).not.toBe(before.sections[0]?.lines[0]);
    expect(after).toEqual(before);
  });
});

describe("closestGuessBySlot", () => {
  function tried(display: string, near: [number, number][], found = false): PlacedGuess {
    return { display, found, near: near.map(([position, score]) => ({ position, score })) };
  }

  it("gives each hidden word the closest guess that came near it", () => {
    // Most recent first, like the tried-word list.
    const bySlot = closestGuessBySlot([
      tried("azur", [
        [4, 45],
        [6, 70],
      ]),
      tried("nuage", [[4, 60]]),
    ]);
    expect(bySlot.get(4)).toEqual({ text: "nuage", score: 60 });
    expect(bySlot.get(6)).toEqual({ text: "azur", score: 70 });
  });

  it("lets a later guess take a word over only by being strictly closer", () => {
    expect(closestGuessBySlot([tried("newer", [[4, 50]]), tried("older", [[4, 50]])]).get(4)?.text).toBe("older");
    expect(closestGuessBySlot([tried("newer", [[4, 51]]), tried("older", [[4, 50]])]).get(4)?.text).toBe("newer");
  });

  it("ignores found words", () => {
    expect(closestGuessBySlot([tried("bleu", [[4, 90]], true)]).size).toBe(0);
  });

  it("has nothing to show before any close guess", () => {
    expect(closestGuessBySlot([]).size).toBe(0);
    expect(closestGuessBySlot([tried("zzz", [])]).size).toBe(0);
  });

  it("does not reorder the list it was given", () => {
    const words = [tried("a", [[1, 40]]), tried("b", [[1, 50]])];
    closestGuessBySlot(words);
    expect(words.map((word) => word.display)).toEqual(["a", "b"]);
  });
});

describe("parseNearSlots", () => {
  it("keeps well-formed slots", () => {
    expect(parseNearSlots([{ position: 3, score: 64 }])).toEqual([{ position: 3, score: 64 }]);
  });

  it("drops malformed entries instead of throwing", () => {
    expect(
      parseNearSlots([
        { position: -1, score: 50 },
        { position: 1.5, score: 50 },
        { position: "2", score: 50 },
        { position: 2, score: Number.NaN },
        { position: 2 },
        null,
        "junk",
        { position: 4, score: 41 },
      ])
    ).toEqual([{ position: 4, score: 41 }]);
  });

  it("keeps a score inside the 0-100 scale", () => {
    expect(parseNearSlots([{ position: 0, score: 250 }])).toEqual([{ position: 0, score: 100 }]);
  });

  it("treats anything but a list as no slots at all", () => {
    expect(parseNearSlots(undefined)).toEqual([]);
    expect(parseNearSlots({ position: 1, score: 50 })).toEqual([]);
  });
});

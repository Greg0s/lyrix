import { describe, expect, it } from "vitest";
import { buildTitleView, isVictory, revealedPositions, songGuessKey } from "../../../src/game/mask";
import type { DisplayToken, RoundView, Song } from "../../../src/game/types";
import { buildGuessDelta, buildRoundView, evaluateGuess, revealedCount } from "../../../worker/src/round";

/**
 * A guess typed with an elision ("j'aime") used to find its word ("aime")
 * everywhere and leave the elided "j" hidden in front of it, though the
 * lyrics had "j'aime" itself: the player had found it whole.
 */

const env = { STATE_SECRET: "test-secret" };
const DAY = "2026-11-17";

const song: Song = {
  id: "elision-test-song",
  title: "J'aime la pluie",
  artist: "Test Artist",
  sections: [
    {
      label: "Couplet 1",
      lines: ["Je t’aime et tu aimes", "J'ai dit que j'aime la nuit", "On s'aime, aime-moi"],
    },
  ],
};

function words(view: RoundView): DisplayToken[] {
  return [...view.title.tokens, ...view.sections.flatMap((s) => s.lines.flatMap((l) => l.tokens))].filter(
    (token) => token.isWord
  );
}

/** Each word as shown: its text once revealed, "_" otherwise. */
function shown(view: RoundView): string {
  return words(view)
    .map((token) => (token.revealed ? token.text : "_"))
    .join(" ");
}

describe("a guess typed with an elision", () => {
  it("is kept under its elided key where the song glues that elision to that word", () => {
    expect(songGuessKey(song, "j'aime")).toBe("j'aime");
    expect(songGuessKey(song, "J’aime !")).toBe("j'aime");
    expect(songGuessKey(song, "t'aime")).toBe("t'aime");
    // No "l'aime" in the song: the word alone.
    expect(songGuessKey(song, "l'aime")).toBe("aime");
    expect(songGuessKey(song, "aime")).toBe("aime");
  });

  it("reveals the elision in front of its word, every occurrence of the word, and no other elision", async () => {
    const outcome = await evaluateGuess(env, song, new Set(), "j'aime");
    expect(outcome).toMatchObject({ key: "j'aime", found: true });

    const view = await buildRoundView(song, [outcome.key], env, DAY);
    // Title "J'aime la pluie"; "j" of "J'ai" and "t" of "t'aime" stay hidden.
    expect(shown(view)).toBe("J aime _ _ _ _ aime _ _ _ _ _ _ _ j aime _ _ _ _ aime aime _");
  });

  it("reveals only the word, as before, where the song has it without that elision", async () => {
    const view = await buildRoundView(song, ["aime"], env, DAY);
    expect(shown(view)).toBe("_ aime _ _ _ _ aime _ _ _ _ _ _ _ _ aime _ _ _ _ aime aime _");
  });

  it("reveals the same in a delta as in a full view, and counts it the same", async () => {
    const before = await buildRoundView(song, ["aime"], env, DAY);
    const outcome = await evaluateGuess(env, song, new Set(["aime"]), "j'aime");
    const delta = await buildGuessDelta(song, ["aime", outcome.key], outcome, env, DAY);
    const after = await buildRoundView(song, ["aime", outcome.key], env, DAY);

    const revealedBefore = words(before).flatMap((token, position) => (token.revealed ? [position] : []));
    const revealedAfter = words(after).flatMap((token, position) => (token.revealed ? [position] : []));
    const fromDelta = new Set([...revealedBefore, ...delta.reveal.map((slot) => slot.position)]);
    expect([...fromDelta].sort((a, b) => a - b)).toEqual(revealedAfter);
    expect(delta.revealed).toBe(revealedAfter.length);
    expect(revealedCount(song, ["j", "j'aime"])).toBe(
      words(await buildRoundView(song, ["j", "j'aime"], env, DAY)).filter((token) => token.revealed).length
    );
    expect(revealedPositions(song, "j'aime")).toContain(0);
  });

  it("wins a title only once its elision is found too", () => {
    expect(isVictory(song, new Set(["aime", "la", "pluie"]))).toBe(false);
    expect(isVictory(song, new Set(["j'aime", "la", "pluie"]))).toBe(true);
    expect(isVictory(song, new Set(["j", "aime", "la", "pluie"]))).toBe(true);
    expect(buildTitleView(song, new Set(["j'aime"])).filter((token) => token.isWord).map((t) => t.revealed)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

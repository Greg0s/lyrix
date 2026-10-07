import { describe, expect, it } from "vitest";
import { analyzeSong } from "../../../src/game/analyze";
import { applyReveal, isGuessDelta, revealedWords, wordCount } from "../../../src/game/delta";
import { normalize } from "../../../src/game/normalize";
import type { GuessDelta, RoundView, Song } from "../../../src/game/types";
import { buildGuessDelta, buildRoundView, type GuessOutcome } from "../../../worker/src/round";

const env = { STATE_SECRET: "test-secret" };
const DAY = "2026-10-07";

// Accents, case and elisions: each occurrence must come back as the song writes it.
const song: Song = {
  id: "elise-au-jardin",
  title: "Élise au jardin",
  artist: "Quelqu'un",
  sections: [
    { label: "Couplet 1", lines: ["J'aime Élise et elise m'aime", "Le jardin dort, ÉLISE aussi"] },
    { label: "Refrain", lines: ["Qu'il pleuve au jardin", "On chante encore"] },
    { label: "Couplet 2", lines: ["Rien ne bouge ici", "Elise revient au jardin"] },
  ],
};

function found(key: string): GuessOutcome {
  return { key, found: true, score: 100, near: [] };
}

async function deltaFor(foundBefore: string[], key: string): Promise<GuessDelta> {
  return buildGuessDelta(song, [...foundBefore, key], found(key), env, DAY);
}

/** A view with its state blanked: two views of the same round sealed apart only differ by their state's IV. */
function unsealed(view: RoundView): RoundView {
  return { ...view, state: "" };
}

describe("applyReveal", () => {
  it("turns a view into exactly the one the Worker builds once the word is found", async () => {
    const before = await buildRoundView(song, [], env, DAY);
    const delta = await deltaFor([], normalize("Élise"));

    const applied = applyReveal(before, delta.reveal, delta.state);
    const expected = await buildRoundView(song, [normalize("Élise")], env, DAY);

    expect(unsealed(applied)).toEqual(unsealed(expected));
    expect(applied.state).toBe(delta.state);
    expect(revealedWords(applied)).toBe(delta.revealed);
  });

  it("keeps each occurrence's own spelling", async () => {
    const delta = await deltaFor([], "elise");
    expect(delta.reveal.map((slot) => slot.text)).toEqual(["Élise", "Élise", "elise", "ÉLISE", "Elise"]);
  });

  it("converges whatever the order, and applying twice changes nothing", async () => {
    const before = await buildRoundView(song, [], env, DAY);
    const elise = await deltaFor([], "elise");
    const jardin = await deltaFor([], "jardin");

    const forward = applyReveal(applyReveal(before, elise.reveal, "s"), jardin.reveal, "s");
    const backward = applyReveal(applyReveal(applyReveal(before, jardin.reveal, "s"), elise.reveal, "s"), jardin.reveal, "s");

    expect(backward).toEqual(forward);
    expect(revealedWords(backward)).toBe(revealedWords(forward));
    expect(revealedWords(forward)).toBe(elise.reveal.length + jardin.reveal.length);
  });

  it("keeps every line it doesn't touch, and the title when no title word is revealed", async () => {
    const before = await buildRoundView(song, [], env, DAY);
    const delta = await deltaFor([], "pleuve");

    const after = applyReveal(before, delta.reveal, delta.state);

    expect(after.title).toBe(before.title);
    expect(after.sections[0]).toBe(before.sections[0]);
    expect(after.sections[2]).toBe(before.sections[2]);
    expect(after.sections[1]?.lines[0]).not.toBe(before.sections[1]?.lines[0]);
    expect(after.sections[1]?.lines[1]).toBe(before.sections[1]?.lines[1]);
  });

  it("ignores a slot pointing at nothing or at a word already out", async () => {
    const before = await buildRoundView(song, [normalize("Élise")], env, DAY);
    const after = applyReveal(before, [{ position: 0, text: "Élise" }, { position: 999, text: "x" }], "s");

    expect(unsealed(after)).toEqual(unsealed(before));
    expect(revealedWords(after)).toBe(revealedWords(before));
  });

  it("counts the round's words", async () => {
    const view = await buildRoundView(song, [], env, DAY);
    expect(wordCount(view)).toBe(analyzeSong(song).wordTexts.length);
  });
});

describe("isGuessDelta", () => {
  it("tells a delta from a full view", async () => {
    const delta = await deltaFor([], "jardin");
    const full = { ...(await buildRoundView(song, [], env, DAY)), key: "x", found: false, score: null, near: [] };
    expect(isGuessDelta(delta)).toBe(true);
    expect(isGuessDelta(full)).toBe(false);
  });
});

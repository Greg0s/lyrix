import { describe, expect, it } from "vitest";
import {
  availableHints,
  canReveal,
  hintCardText,
  hintRows,
  HINT_THRESHOLDS,
  parseRoundHints,
  unlockedHints,
} from "../../../src/game/hints";
import type { RoundHints } from "../../../src/game/types";

const solo = { victory: false, group: false };

function hints(tried: number, used: RoundHints["used"] = [], values: RoundHints["values"] = {}): RoundHints {
  return { tried, used, values };
}

describe("unlocking hints", () => {
  it("allows one more hint at each threshold", () => {
    expect(HINT_THRESHOLDS).toEqual([20, 35, 50]);
    expect([0, 19, 20, 34, 35, 49, 50, 80].map(unlockedHints)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("counts the hints left to pick, whichever were picked", () => {
    expect(availableHints(hints(20))).toBe(1);
    expect(availableHints(hints(20, ["style"]))).toBe(0);
    expect(availableHints(hints(40))).toBe(2);
    expect(canReveal(hints(40, ["style"]), "era")).toBe(true);
    expect(canReveal(hints(40, ["style"]), "style")).toBe(false);
    expect(canReveal(hints(19), "era")).toBe(false);
  });
});

describe("parseRoundHints", () => {
  it("keeps well-formed hints and only their known text", () => {
    expect(parseRoundHints({ tried: 3, used: ["era"], values: { era: "Années 80", other: "x", style: 4 } })).toEqual(
      hints(3, ["era"], { era: "Années 80" })
    );
  });

  it("refuses anything else", () => {
    for (const value of [null, {}, { tried: -1, used: [], values: {} }, { tried: 1.5, used: [], values: {} }]) {
      expect(parseRoundHints(value)).toBeNull();
    }
    expect(parseRoundHints({ tried: 1, used: ["era", "era"], values: {} })).toBeNull();
    expect(parseRoundHints({ tried: 1, used: ["artist"], values: {} })).toBeNull();
  });
});

describe("the hints card", () => {
  it("shows every hint locked before the first threshold, with the rule and how far it is", () => {
    const text = hintCardText(hints(13), solo);
    expect(hintRows(hints(13), false).map((row) => row.kind)).toEqual(["locked", "locked", "locked"]);
    expect(text).toMatchObject({ badge: null, counter: "0 / 3", intro: null, proud: false });
    expect(text.meter).toEqual({ label: "Premier indice", from: 0, to: 20, now: 13 });
    expect(text.footer).toBe("Un indice à 20, 35 et 50 essais : à chaque fois, tu choisis lequel.");
  });

  it("offers the hints left once a threshold is reached, and says when the next ones come", () => {
    const first = hintCardText(hints(20), solo);
    expect(first).toMatchObject({ badge: "1 à choisir", intro: "Choisis l'indice à révéler.", meter: null });
    expect(first.footer).toBe("Les suivants à 35 puis 50 essais.");

    const second = hints(35, ["era"], { era: "Années 90" });
    expect(hintRows(second, false).map((row) => row.kind)).toEqual(["revealed", "choice", "choice"]);
    expect(hintCardText(second, solo)).toMatchObject({ intro: "Choisis le deuxième indice.", footer: "Le dernier à 50 essais." });

    const last = hints(50, ["era", "style"], { era: "Années 90", style: "Rock" });
    expect(hintCardText(last, solo)).toMatchObject({ intro: "Il reste un dernier indice à révéler.", footer: null });
  });

  it("runs the meter from the last threshold to the next once a hint is taken", () => {
    const text = hintCardText(hints(27, ["era"], { era: "Années 90" }), solo);
    expect(text).toMatchObject({ badge: null, counter: "1 / 3", footer: null });
    expect(text.meter).toEqual({ label: "Prochain indice", from: 20, to: 35, now: 27 });
    expect(hintCardText(hints(40, ["era", "style"]), solo).meter?.label).toBe("Dernier indice");
  });

  it("keeps every row in place, a revealed value where its hint was", () => {
    expect(hintRows(hints(20, ["style"], { style: "Rock" }), false)).toEqual([
      { id: "era", label: "Époque", kind: "locked" },
      { id: "artistType", label: "Type d'artiste", kind: "locked" },
      { id: "style", label: "Style", kind: "revealed", value: "Rock" },
    ]);
  });

  it("shows every hint once won, the unused ones marked, and how many helped", () => {
    const won = hints(30, ["era"], { era: "Années 90", artistType: "Un groupe français", style: "Rock" });
    expect(hintRows(won, true).map((row) => row.kind)).toEqual(["revealed", "unused", "unused"]);
    expect(hintCardText(won, { victory: true, group: false })).toMatchObject({ footer: "Trouvée avec 1 indice.", proud: false });
    expect(hintCardText(hints(12), { victory: true, group: false })).toMatchObject({ footer: "Trouvée sans indice !", proud: true });
  });

  it("speaks to the group in a room", () => {
    expect(hintCardText(hints(20), { victory: false, group: true })).toMatchObject({
      intro: "Pour tout le groupe : le premier qui choisit le révèle à tous.",
      footer: "Les suivants à 35 puis 50 essais du groupe.",
    });
    expect(hintCardText(hints(5), { victory: false, group: true }).footer).toBe(
      "Un indice à 20, 35 et 50 essais du groupe : à chaque fois, le groupe choisit lequel."
    );
  });
});

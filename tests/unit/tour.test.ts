import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIP_GAP, TIP_MARGIN, TOUR_STEPS, placeTip, spotlightBox } from "../../src/tour";
import { TOUR_STORAGE_KEY, isTourSeen, markTourSeen } from "../../src/tourStorage";

const phone = { width: 390, height: 700 };
const tip = { width: 340, height: 180 };

describe("the guided tour's steps", () => {
  it("each point at a distinct element", () => {
    const targets = TOUR_STEPS.map((step) => step.target);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("end on \"Comment jouer\", where the rules stay within reach", () => {
    expect(TOUR_STEPS.at(-1)?.target).toBe("help");
  });

  it("each have their element marked in a component", () => {
    const sources = [
      "AppHeader",
      "TitleGuess",
      "LyricsBody",
      "GuessForm",
      "TriedWords",
      "HintsCard",
    ].map((name) => readFileSync(`src/components/${name}.tsx`, "utf8"));
    for (const { target } of TOUR_STEPS) {
      expect(sources.some((source) => source.includes(`"${target}"`) && source.includes("data-tour")), target).toBe(true);
    }
  });
});

describe("placeTip", () => {
  it("goes under its target when it fits, centred on it", () => {
    const placed = placeTip({ top: 100, left: 95, width: 200, height: 40 }, tip, phone);
    expect(placed.side).toBe("below");
    expect(placed.top).toBe(140 + TIP_GAP);
    expect(placed.left).toBe(TIP_MARGIN + 9);
    expect(placed.arrowLeft).toBe(195 - placed.left);
  });

  it("goes over it near the bottom of the screen (the guess dock)", () => {
    const placed = placeTip({ top: 590, left: 0, width: 390, height: 100 }, tip, phone);
    expect(placed.side).toBe("above");
    expect(placed.top).toBe(590 - TIP_GAP - tip.height);
  });

  it("never leaves the screen, sliding in from its edges, its arrow still on the target", () => {
    const placed = placeTip({ top: 10, left: 350, width: 32, height: 32 }, tip, phone);
    expect(placed.left).toBe(phone.width - TIP_MARGIN - tip.width);
    expect(placed.arrowLeft).toBe(tip.width - 20);
    const tall = placeTip({ top: 0, left: 0, width: 390, height: 700 }, tip, phone);
    expect(tall.top).toBeGreaterThanOrEqual(TIP_MARGIN);
    expect(tall.top + tip.height).toBeLessThanOrEqual(phone.height - TIP_MARGIN);
  });
});

describe("spotlightBox", () => {
  it("pads its target, and is cut to the screen", () => {
    expect(spotlightBox({ top: 100, left: 20, width: 100, height: 40 }, phone)).toEqual({
      top: 94,
      left: 14,
      width: 112,
      height: 52,
    });
    expect(spotlightBox({ top: -50, left: 0, width: 390, height: 900 }, phone)).toEqual({
      top: 0,
      left: 0,
      width: 390,
      height: 700,
    });
  });
});

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

describe("tourStorage", () => {
  it("remembers the tour was shown", () => {
    const storage = new MemoryStorage();
    expect(isTourSeen(storage)).toBe(false);
    markTourSeen(storage);
    expect(isTourSeen(storage)).toBe(true);
    expect(storage.getItem(TOUR_STORAGE_KEY)).toBe("1");
  });

  it("counts a storage it can't read as seen, so a blocked one doesn't show it on every visit", () => {
    const blocked = new MemoryStorage();
    blocked.getItem = () => {
      throw new Error("SecurityError");
    };
    blocked.setItem = () => {
      throw new Error("SecurityError");
    };
    expect(isTourSeen(blocked)).toBe(true);
    expect(() => markTourSeen(blocked)).not.toThrow();
  });
});

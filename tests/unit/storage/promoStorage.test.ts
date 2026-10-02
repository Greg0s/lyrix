import { beforeEach, describe, expect, it } from "vitest";
import { MONTHLY_DISMISSALS, PROMO_STORAGE_KEY, dismissPromo, isPromoDismissed } from "../../../src/promoStorage";

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

const at = (day: string, time = "12:00:00") => new Date(`${day}T${time}Z`);

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe("the multiplayer card's dismissals", () => {
  it("shows the card until it is closed", () => {
    expect(isPromoDismissed(at("2026-10-02"), storage)).toBe(false);
  });

  it("hides it for the rest of the UTC day only", () => {
    dismissPromo(at("2026-10-02", "08:00:00"), storage);
    expect(isPromoDismissed(at("2026-10-02", "23:59:59"), storage)).toBe(true);
    expect(isPromoDismissed(at("2026-10-03", "00:00:00"), storage)).toBe(false);
  });

  it(`hides it until next month once closed ${MONTHLY_DISMISSALS} times in one`, () => {
    for (let day = 1; day < MONTHLY_DISMISSALS; day += 1) dismissPromo(at(`2026-10-0${day}`), storage);
    expect(isPromoDismissed(at("2026-10-20"), storage)).toBe(false);

    dismissPromo(at("2026-10-20"), storage);
    expect(isPromoDismissed(at("2026-10-21"), storage)).toBe(true);
    expect(isPromoDismissed(at("2026-10-31", "23:59:59"), storage)).toBe(true);
    expect(isPromoDismissed(at("2026-11-01", "00:00:00"), storage)).toBe(false);
  });

  it("starts counting again each month", () => {
    for (let day = 1; day < MONTHLY_DISMISSALS; day += 1) dismissPromo(at(`2026-10-1${day}`), storage);
    dismissPromo(at("2026-11-02"), storage);
    expect(isPromoDismissed(at("2026-11-03"), storage)).toBe(false);
  });

  it("shows the card when what was stored is unreadable", () => {
    storage.setItem(PROMO_STORAGE_KEY, "1");
    expect(isPromoDismissed(at("2026-10-02"), storage)).toBe(false);
    storage.setItem(PROMO_STORAGE_KEY, "{not json");
    expect(isPromoDismissed(at("2026-10-02"), storage)).toBe(false);
  });
});

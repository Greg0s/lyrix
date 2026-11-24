import { beforeEach, describe, expect, it } from "vitest";
import type { ArchiveEntry } from "../../../src/game/archive";
import {
  INSTALL_STORAGE_KEY,
  MAX_DISMISSALS,
  SNOOZE_DAYS,
  dismissInstallOffer,
  isInstallOfferDue,
  isInstallOfferSnoozed,
  markInstallDone,
  songsFound,
} from "../../../src/installStorage";

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

const at = (day: string) => new Date(`${day}T12:00:00Z`);

const entry = (victory: boolean): ArchiveEntry => ({ title: [], percent: victory ? 40 : 5, victory, tries: 12 });

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe("who is offered to install Lyrix", () => {
  it("counts only the songs found", () => {
    expect(songsFound({ "2026-11-20": entry(true), "2026-11-21": entry(false), "2026-11-22": entry(true) })).toBe(2);
  });

  it("counts the round just won, saved yet or not, once", () => {
    const archive = { "2026-11-22": entry(true), "2026-11-23": entry(false) };
    expect(songsFound(archive, "2026-11-23")).toBe(2);
    expect(songsFound(archive, "2026-11-22")).toBe(1);
  });

  it("waits for a second song found", () => {
    expect(isInstallOfferDue(1, at("2026-11-23"), storage)).toBe(false);
    expect(isInstallOfferDue(2, at("2026-11-23"), storage)).toBe(true);
  });

  it("leaves a player who said no alone for two weeks", () => {
    dismissInstallOffer(at("2026-11-23"), storage);
    expect(isInstallOfferDue(2, at("2026-11-23"), storage)).toBe(false);
    const lastQuietDay = new Date(at("2026-11-23").getTime() + (SNOOZE_DAYS - 1) * 86_400_000);
    expect(isInstallOfferSnoozed(lastQuietDay, storage)).toBe(true);
    const back = new Date(at("2026-11-23").getTime() + SNOOZE_DAYS * 86_400_000);
    expect(isInstallOfferSnoozed(back, storage)).toBe(false);
  });

  it("never asks again once turned down three times", () => {
    for (let i = 0; i < MAX_DISMISSALS; i++) dismissInstallOffer(at("2026-01-01"), storage);
    expect(isInstallOfferSnoozed(at("2027-06-01"), storage)).toBe(true);
  });

  it("never asks again once the player says it is done", () => {
    markInstallDone(at("2026-11-23"), storage);
    expect(isInstallOfferSnoozed(at("2027-06-01"), storage)).toBe(true);
  });

  it("reads a damaged entry as none", () => {
    storage.setItem(INSTALL_STORAGE_KEY, "{oops");
    expect(isInstallOfferSnoozed(at("2026-11-23"), storage)).toBe(false);
    storage.setItem(INSTALL_STORAGE_KEY, JSON.stringify({ count: 0, lastDay: "2026-11-23" }));
    expect(isInstallOfferSnoozed(at("2026-11-23"), storage)).toBe(false);
  });
});

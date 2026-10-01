import { utcDay } from "../../../src/game/daily";
import { describe, expect, it } from "vitest";
import type { RoomEntry } from "../../../src/game/room";
import { clearSavedRoom, isAnswerRevealed, loadSavedRoom, saveAnswerRevealed, saveRoom } from "../../../src/roomStorage";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

const NOW = Date.UTC(2026, 8, 29, 20);

function entry(expiresAt = Date.UTC(2026, 8, 30)): RoomEntry {
  const host = { id: "m1", name: "Camille", number: 1 };
  return { you: "m1", token: "token", room: { code: "ABC234", host, members: [host], expiresAt } };
}

function storage(): Storage {
  return new MemoryStorage() as unknown as Storage;
}

describe("the saved room", () => {
  it("comes back as it was saved", () => {
    const store = storage();
    saveRoom(entry(), store);
    expect(loadSavedRoom(NOW, store)).toEqual(entry());
  });

  it("is gone once cleared", () => {
    const store = storage();
    saveRoom(entry(), store);
    clearSavedRoom(store);
    expect(loadSavedRoom(NOW, store)).toBeNull();
  });

  // A room ends with the day's song: a tab reopened tomorrow must not try to reconnect to it.
  it("is dropped, and forgotten, once the room has expired", () => {
    const store = storage();
    saveRoom(entry(NOW), store);
    expect(loadSavedRoom(NOW, store)).toBeNull();
    expect(store.getItem("lyrix:room")).toBeNull();
  });

  it("is ignored when unreadable, rather than breaking the page", () => {
    const store = storage();
    store.setItem("lyrix:room", "{not json");
    expect(loadSavedRoom(NOW, store)).toBeNull();
    store.setItem("lyrix:room", JSON.stringify({ you: "m1" }));
    expect(loadSavedRoom(NOW, store)).toBeNull();
  });

  it("never throws when storage does", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    expect(loadSavedRoom(NOW, broken)).toBeNull();
    expect(() => saveRoom(entry(), broken)).not.toThrow();
    expect(() => clearSavedRoom(broken)).not.toThrow();
  });
});

// A room plays several days (#B): the answer the player chose to see is one day's.
describe("the answers a player chose to see", () => {
  function memoryStorage(initial: Record<string, string> = {}): Storage {
    const store = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  }

  it("are kept per room and per day", () => {
    const storage = memoryStorage();
    saveAnswerRevealed("ABC234", "2026-09-20", storage);
    expect(isAnswerRevealed("ABC234", "2026-09-20", storage)).toBe(true);
    expect(isAnswerRevealed("ABC234", "2026-09-21", storage)).toBe(false);
    saveAnswerRevealed("ABC234", "2026-09-21", storage);
    expect(isAnswerRevealed("ABC234", "2026-09-20", storage)).toBe(true);
  });

  it("forget another room's", () => {
    const storage = memoryStorage();
    saveAnswerRevealed("ABC234", "2026-09-20", storage);
    saveAnswerRevealed("XYZ789", "2026-09-20", storage);
    expect(isAnswerRevealed("ABC234", "2026-09-20", storage)).toBe(false);
  });

  it("read one saved before rooms played several days as today's", () => {
    const storage = memoryStorage({ "lyrix:room-answer": "ABC234" });
    expect(isAnswerRevealed("ABC234", utcDay(), storage)).toBe(true);
    expect(isAnswerRevealed("ABC234", "2026-09-20", storage)).toBe(false);
  });
});

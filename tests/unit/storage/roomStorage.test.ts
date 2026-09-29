import { describe, expect, it } from "vitest";
import type { RoomEntry } from "../../../src/game/room";
import { clearSavedRoom, loadSavedRoom, saveRoom } from "../../../src/roomStorage";

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

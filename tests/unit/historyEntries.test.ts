import { describe, expect, it } from "vitest";
import { entryOf, pushedEntry, replacedEntry, stepsBackToPlay } from "../../src/historyEntries";

/**
 * The places the tab bar reads to go Back to « Jouer » rather than add it
 * again (useRoute's navigateTab): Back from any tab is « Jouer », then out.
 */
describe("history entries", () => {
  it("reads an entry the game never wrote as the first, with no round below", () => {
    expect(entryOf(null)).toEqual({ lyrixIndex: 0, lyrixPlay: null });
    expect(entryOf({ lyrixLayer: "x" })).toEqual({ lyrixIndex: 0, lyrixPlay: null });
  });

  it("finds « Jouer » below the tabs left on top of it", () => {
    const play = replacedEntry(null, "/", true);
    const archives = pushedEntry(play, "/archives", false);
    const room = replacedEntry(archives, "/jouer-a-plusieurs", false);
    expect(room).toEqual({ lyrixIndex: 1, lyrixPlay: { index: 0, path: "/" } });
    expect(stepsBackToPlay(room, "/")).toBe(-1);
    // Another round than the one below is not gone back to.
    expect(stepsBackToPlay(room, "/archives/2026-11-20")).toBeNull();
  });

  it("finds it below a page opened from a tab, too", () => {
    const more = pushedEntry(replacedEntry(null, "/", true), "/comment-jouer", false);
    const legal = pushedEntry(more, "/mentions-legales", false);
    expect(stepsBackToPlay(legal, "/")).toBe(-2);
  });

  it("forgets it once its own entry is replaced by another screen", () => {
    const play = replacedEntry(null, "/", true);
    expect(stepsBackToPlay(replacedEntry(play, "/archives", false), "/")).toBeNull();
  });

  it("never goes back from « Jouer » itself", () => {
    expect(stepsBackToPlay(replacedEntry(null, "/", true), "/")).toBeNull();
  });
});

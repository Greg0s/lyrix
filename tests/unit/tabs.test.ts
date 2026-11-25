import { describe, expect, it } from "vitest";
import { commitsSwipe, SWIPE_MAX_MS, SWIPE_MIN_DISTANCE, touchAxis } from "../../src/hooks/useSwipeTabs";
import { ARCHIVES, HELP, LEGAL, ROOM, TODAY, type Route } from "../../src/routes";
import { swipedTab, tabRoute, TAB_ORDER } from "../../src/tabs";

const DAY: Route = { name: "day", day: "2026-11-20" };

describe("swipedTab", () => {
  it("goes to the next tab for a finger moving left, the previous one for a finger moving right", () => {
    expect(swipedTab(TODAY, "left")).toBe("archives");
    expect(swipedTab(ARCHIVES, "left")).toBe("room");
    expect(swipedTab(ROOM, "left")).toBe("more");
    expect(swipedTab(HELP, "right")).toBe("room");
    expect(swipedTab(ROOM, "right")).toBe("archives");
    expect(swipedTab(ARCHIVES, "right")).toBe("play");
  });

  it("goes nowhere past either end", () => {
    expect(swipedTab(TODAY, "right")).toBeNull();
    expect(swipedTab(DAY, "right")).toBeNull();
    expect(swipedTab(HELP, "left")).toBeNull();
  });

  it("goes nowhere from a screen under no tab", () => {
    expect(swipedTab(LEGAL, "left")).toBeNull();
    expect(swipedTab(LEGAL, "right")).toBeNull();
  });

  it("keeps the tab bar's order", () => {
    expect(TAB_ORDER).toEqual(["play", "archives", "room", "more"]);
  });
});

describe("tabRoute", () => {
  it("plays the day of the archives shown, today's song from anywhere else", () => {
    expect(tabRoute("play", DAY)).toEqual(DAY);
    expect(tabRoute("play", ARCHIVES)).toEqual(TODAY);
    expect(tabRoute("archives", DAY)).toEqual(ARCHIVES);
    expect(tabRoute("room", TODAY)).toEqual(ROOM);
    expect(tabRoute("more", TODAY)).toEqual(HELP);
  });
});

describe("commitsSwipe", () => {
  it("goes over on a quick flick, or on a drag across a good part of the screen however slow", () => {
    expect(commitsSwipe(-SWIPE_MIN_DISTANCE, 200, 390)).toBe(true);
    expect(commitsSwipe(120, 200, 390)).toBe(true);
    expect(commitsSwipe(-130, 3000, 390)).toBe(true);
  });

  it("springs back from a short move, or a slow one not far enough", () => {
    expect(commitsSwipe(-(SWIPE_MIN_DISTANCE - 1), 100, 390)).toBe(false);
    expect(commitsSwipe(-100, SWIPE_MAX_MS + 1, 390)).toBe(false);
  });
});

describe("touchAxis", () => {
  it("is a scroll once a touch moved up or down further than sideways", () => {
    expect(touchAxis(2, 20)).toBe("scroll");
    expect(touchAxis(-5, -14)).toBe("scroll");
  });

  it("is a swipe once it moved sideways first", () => {
    expect(touchAxis(14, 5)).toBe("swipe");
    expect(touchAxis(-40, 20)).toBe("swipe");
  });

  it("is not known yet for a jitter", () => {
    expect(touchAxis(0, 6)).toBeNull();
    expect(touchAxis(8, 2)).toBeNull();
  });
});

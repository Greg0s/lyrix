import { describe, expect, it } from "vitest";
import { readSwipe, startsScrolling, SWIPE_MAX_MS, SWIPE_MIN_DISTANCE } from "../../src/hooks/useSwipeTabs";
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

describe("readSwipe", () => {
  it("reads a quick, wide, flat move as a swipe", () => {
    expect(readSwipe(-120, 10, 200)).toBe("left");
    expect(readSwipe(120, -10, 200)).toBe("right");
  });

  it("leaves a short, steep or slow move alone", () => {
    expect(readSwipe(-(SWIPE_MIN_DISTANCE - 1), 0, 100)).toBeNull();
    expect(readSwipe(-100, 60, 100)).toBeNull();
    expect(readSwipe(-200, 0, SWIPE_MAX_MS + 1)).toBeNull();
  });
});

describe("startsScrolling", () => {
  it("is a scroll once a touch moved up or down further than sideways", () => {
    expect(startsScrolling(2, 20)).toBe(true);
    expect(startsScrolling(-5, -14)).toBe(true);
  });

  it("is not yet one for a jitter, nor for a sideways move", () => {
    expect(startsScrolling(0, 6)).toBe(false);
    expect(startsScrolling(40, 20)).toBe(false);
  });
});

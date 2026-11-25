// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwipeTabs, SWIPE_MEDIA } from "../../../src/hooks/useSwipeTabs";
import { ARCHIVES, HELP, LEGAL, ROOM, TODAY, type Route } from "../../../src/routes";

/**
 * A sideways swipe on a phone moves to the tab beside the one shown, through
 * the same navigate as a tap on the tab; anything else a finger does is left
 * to the browser. tests/e2e/mobile.spec.ts swipes in a real browser.
 */

const WIDTH = 390;
let phone = true;

beforeEach(() => {
  phone = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === SWIPE_MEDIA && phone;
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("innerWidth", WIDTH);
  document.body.innerHTML = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Point {
  x: number;
  y: number;
}

function touchEvent(type: string, point: Point, at: number, target: EventTarget): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === "touchend" ? [] : [{ clientX: point.x, clientY: point.y }];
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: [{ clientX: point.x, clientY: point.y }] },
    timeStamp: { value: at },
  });
  target.dispatchEvent(event);
  return event;
}

/** A finger from `from` to `to` over `ms`, through a point halfway. */
function swipe(from: Point, to: Point, { ms = 200, target = document.body as EventTarget } = {}): void {
  touchEvent("touchstart", from, 1000, target);
  touchEvent("touchmove", { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, 1000 + ms / 2, target);
  touchEvent("touchmove", to, 1000 + ms, target);
  touchEvent("touchend", to, 1000 + ms, target);
}

const left = (target?: EventTarget) => swipe({ x: 300, y: 400 }, { x: 120, y: 410 }, { target });
const right = (target?: EventTarget) => swipe({ x: 120, y: 400 }, { x: 300, y: 410 }, { target });

function mount(route: Route) {
  const navigate = vi.fn();
  const hook = renderHook(({ shown }) => useSwipeTabs(shown, navigate), { initialProps: { shown: route } });
  return { navigate, hook };
}

describe("useSwipeTabs", () => {
  it("moves to the next tab on a swipe left, the previous one on a swipe right", () => {
    const { navigate, hook } = mount(TODAY);
    left();
    expect(navigate).toHaveBeenLastCalledWith(ARCHIVES);

    hook.rerender({ shown: ARCHIVES });
    left();
    expect(navigate).toHaveBeenLastCalledWith(ROOM);

    hook.rerender({ shown: HELP });
    right();
    expect(navigate).toHaveBeenLastCalledWith(ROOM);
    expect(navigate).toHaveBeenCalledTimes(3);
  });

  it("goes nowhere past the first or the last tab, nor from the legal notice", () => {
    const { navigate, hook } = mount(TODAY);
    right();
    hook.rerender({ shown: HELP });
    left();
    hook.rerender({ shown: LEGAL });
    left();
    right();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves a scroll alone, even one that ends sideways", () => {
    const { navigate } = mount(TODAY);
    swipe({ x: 200, y: 600 }, { x: 200, y: 200 });
    // Down first, then across: the browser was already scrolling.
    touchEvent("touchstart", { x: 300, y: 400 }, 0, document.body);
    touchEvent("touchmove", { x: 298, y: 430 }, 50, document.body);
    touchEvent("touchmove", { x: 100, y: 450 }, 150, document.body);
    touchEvent("touchend", { x: 100, y: 450 }, 150, document.body);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves the screen's edges to the system's back gesture", () => {
    const { navigate } = mount(ARCHIVES);
    swipe({ x: 4, y: 400 }, { x: 200, y: 400 });
    swipe({ x: WIDTH - 4, y: 400 }, { x: 180, y: 400 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves a slow drag alone", () => {
    const { navigate } = mount(TODAY);
    swipe({ x: 300, y: 400 }, { x: 100, y: 400 }, { ms: 1500 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("never swipes from the guess dock, while typing, or under a dialog", () => {
    const { navigate } = mount(TODAY);
    document.body.innerHTML = `
      <div class="lyrix-dock"><input id="guess" /><button id="dock-button">Tes mots</button></div>
      <div id="strip" style="overflow-x: auto"><span id="chip">chip</span></div>
      <p id="lyrics">la la la</p>`;
    left(document.getElementById("dock-button")!);
    left(document.getElementById("chip")!);

    document.getElementById("guess")!.focus();
    left(document.getElementById("lyrics")!);
    document.getElementById("guess")!.blur();

    const dialog = document.createElement("div");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(dialog);
    left(document.getElementById("lyrics")!);
    dialog.remove();
    expect(navigate).not.toHaveBeenCalled();

    left(document.getElementById("lyrics")!);
    expect(navigate).toHaveBeenCalledWith(ARCHIVES);
  });

  it("does nothing from 880px, where there is no tab bar", () => {
    phone = false;
    const { navigate } = mount(TODAY);
    left();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("prevents nothing: scrolling stays the browser's", () => {
    mount(TODAY);
    const events = [
      touchEvent("touchstart", { x: 300, y: 400 }, 0, document.body),
      touchEvent("touchmove", { x: 100, y: 400 }, 100, document.body),
      touchEvent("touchend", { x: 100, y: 400 }, 100, document.body),
    ];
    expect(events.every((event) => !event.defaultPrevented)).toBe(true);
  });
});

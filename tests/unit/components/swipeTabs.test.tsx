// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
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
let reducedMotion = false;

beforeEach(() => {
  phone = true;
  reducedMotion = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      if (query === "(prefers-reduced-motion: reduce)") return reducedMotion;
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
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
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

  it("leaves a slow, short drag alone, and takes a slow one across a good part of the screen", () => {
    const { navigate } = mount(TODAY);
    swipe({ x: 300, y: 400 }, { x: 200, y: 400 }, { ms: 1500 });
    expect(navigate).not.toHaveBeenCalled();
    swipe({ x: 300, y: 400 }, { x: 120, y: 400 }, { ms: 1500 });
    expect(navigate).toHaveBeenCalledWith(ARCHIVES);
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

interface FakeAnimation {
  keyframes: Keyframe[];
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
  cancel: () => void;
}

describe("useSwipeTabs's motion", () => {
  let animations: FakeAnimation[];
  let screen: HTMLElement;

  beforeEach(() => {
    animations = [];
    // jsdom has no Web Animations: a stand-in that finishes when told to.
    HTMLElement.prototype.animate = function (keyframes: Keyframe[]) {
      const animation: FakeAnimation = { keyframes, onfinish: null, oncancel: null, cancel: () => {} };
      animations.push(animation);
      return animation as unknown as Animation;
    } as HTMLElement["animate"];
    document.body.innerHTML = '<div class="lyrix-app"><header></header><main id="screen">x</main></div>';
    screen = document.getElementById("screen")!;
  });

  const finish = (animation: FakeAnimation | undefined) => act(() => animation?.onfinish?.());

  it("moves the screen with the finger, then slides it out and the next one in", () => {
    const { navigate } = mount(TODAY);
    touchEvent("touchstart", { x: 300, y: 400 }, 0, screen);
    touchEvent("touchmove", { x: 220, y: 402 }, 50, screen);
    expect(screen.style.transform).toBe("translate3d(-80px, 0, 0)");
    touchEvent("touchend", { x: 220, y: 402 }, 100, screen);
    // Not yet: the screen is still leaving.
    expect(navigate).not.toHaveBeenCalled();
    expect(animations[0].keyframes.at(-1)!.transform).toBe(`translate3d(${-WIDTH}px, 0, 0)`);

    finish(animations[0]);
    expect(navigate).toHaveBeenCalledWith(ARCHIVES);
  });

  it("brings the next screen in from the side the finger moved away from", () => {
    const navigate = vi.fn();
    const hook = renderHook(({ shown }) => useSwipeTabs(shown, navigate), { initialProps: { shown: ARCHIVES } });
    swipe({ x: 100, y: 400 }, { x: 300, y: 400 }, { target: screen });
    finish(animations[0]);
    expect(navigate).toHaveBeenCalledWith(TODAY);
    hook.rerender({ shown: TODAY });
    expect(animations[1].keyframes[0].transform).toBe(`translate3d(${-WIDTH}px, 0, 0)`);
    expect(animations[1].keyframes.at(-1)!.transform).toBe("translate3d(0, 0, 0)");
  });

  it("springs back from a drag too short, the screen left where it was", () => {
    const { navigate } = mount(TODAY);
    touchEvent("touchstart", { x: 300, y: 400 }, 0, screen);
    touchEvent("touchmove", { x: 260, y: 400 }, 400, screen);
    touchEvent("touchend", { x: 260, y: 400 }, 1200, screen);
    expect(screen.style.transform).toBe("");
    expect(animations[0].keyframes.at(-1)!.transform).toBe("translate3d(0, 0, 0)");
    finish(animations[0]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("follows the finger only a little past the first tab, and springs back", () => {
    const { navigate } = mount(TODAY);
    touchEvent("touchstart", { x: 100, y: 400 }, 0, screen);
    touchEvent("touchmove", { x: 300, y: 400 }, 100, screen);
    expect(screen.style.transform).toBe("translate3d(50px, 0, 0)");
    touchEvent("touchend", { x: 300, y: 400 }, 150, screen);
    finish(animations[0]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("just changes screen under reduced motion", () => {
    reducedMotion = true;
    const { navigate, hook } = mount(TODAY);
    touchEvent("touchstart", { x: 300, y: 400 }, 0, screen);
    touchEvent("touchmove", { x: 200, y: 400 }, 50, screen);
    expect(screen.style.transform).toBe("");
    touchEvent("touchend", { x: 150, y: 400 }, 100, screen);
    expect(navigate).toHaveBeenCalledWith(ARCHIVES);
    hook.rerender({ shown: ARCHIVES });
    expect(animations).toHaveLength(0);
  });

  it("starts no swipe while the tour's invitation waits for an answer", () => {
    const { navigate } = mount(TODAY);
    const invite = document.createElement("section");
    invite.className = "lyrix-dock lyrix-invite";
    document.body.append(invite);
    left(screen);
    expect(navigate).not.toHaveBeenCalled();
  });
});

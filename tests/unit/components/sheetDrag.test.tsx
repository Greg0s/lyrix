// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal, MODAL_CLOSE_MS } from "../../../src/components/Modal";
import {
  canStartDrag,
  dismissesSheet,
  DISMISS_SHARE,
  FLICK_MIN_DISTANCE,
  FLICK_SPEED,
  SHEET_MEDIA,
} from "../../../src/hooks/useSheetDrag";

/**
 * On a phone, a finger pulls a sheet ("Tes mots", "Indices") down off the
 * screen by its grip, as a native bottom sheet: far enough or flicked, it
 * closes; too little, it springs back. tests/e2e/mobile.spec.ts drags one in
 * a real browser.
 */

const HEIGHT = 400;
let phone = true;
let reducedMotion = false;

interface FakeAnimation {
  keyframes: Keyframe[];
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
}
let animations: FakeAnimation[] = [];

beforeEach(() => {
  phone = true;
  reducedMotion = false;
  animations = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      if (query === "(prefers-reduced-motion: reduce)") return reducedMotion;
      return query === SHEET_MEDIA && phone;
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => HEIGHT });
  HTMLElement.prototype.animate = function (keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
    const animation: FakeAnimation = { keyframes: keyframes as Keyframe[], onfinish: null, oncancel: null };
    animations.push(animation);
    return animation as unknown as Animation;
  };
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  delete (HTMLElement.prototype as Partial<{ offsetHeight: number }>).offsetHeight;
});

function Screen({ onClosed }: { onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  return open ? (
    <Modal
      title="Tes mots"
      variant="sheet"
      onClosed={() => {
        onClosed();
        setOpen(false);
      }}
    >
      {() => (
        <ul className="list">
          <li>amour</li>
        </ul>
      )}
    </Modal>
  ) : (
    <p>Le jeu</p>
  );
}

function mount() {
  const onClosed = vi.fn();
  render(<Screen onClosed={onClosed} />);
  const panel = screen.getByRole("dialog");
  const grip = panel.querySelector(".lyrix-sheet-grip");
  if (!grip) throw new Error("no grip");
  return { onClosed, panel, grip };
}

function touch(type: string, y: number, at: number, target: EventTarget, x = 200): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = type === "touchend" ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: [{ clientX: x, clientY: y }] },
    timeStamp: { value: at },
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/** A finger from y=`from` down to y=`to` over `ms`, in 8 steps; returns the moves' events. */
function drag(
  target: EventTarget,
  from: number,
  to: number,
  ms: number,
  { x = 200, toX = x }: { x?: number; toX?: number } = {}
): Event[] {
  touch("touchstart", from, 1000, target, x);
  const moves: Event[] = [];
  for (let step = 1; step <= 8; step++) {
    moves.push(
      touch("touchmove", from + ((to - from) * step) / 8, 1000 + (ms * step) / 8, target, x + ((toX - x) * step) / 8)
    );
  }
  touch("touchend", to, 1000 + ms, target, toX);
  return moves;
}

const finishAll = () =>
  act(() => {
    for (const animation of animations) animation.onfinish?.();
  });

describe("dismissesSheet", () => {
  it("closes past a share of the sheet's height, or on a flick down", () => {
    expect(dismissesSheet(HEIGHT * DISMISS_SHARE, 0.1, HEIGHT)).toBe(true);
    expect(dismissesSheet(HEIGHT * DISMISS_SHARE - 1, 0.1, HEIGHT)).toBe(false);
    expect(dismissesSheet(FLICK_MIN_DISTANCE, FLICK_SPEED, HEIGHT)).toBe(true);
    expect(dismissesSheet(FLICK_MIN_DISTANCE - 1, FLICK_SPEED * 2, HEIGHT)).toBe(false);
  });

  it("keeps a sheet being raised back up, however far it was pulled", () => {
    expect(dismissesSheet(HEIGHT * 0.8, -0.5, HEIGHT)).toBe(false);
  });
});

describe("pulling a sheet down", () => {
  it("shows a grip atop a sheet, and none on a dialog", () => {
    const { grip } = mount();
    expect(grip.getAttribute("aria-hidden")).toBe("true");
    cleanup();
    render(
      <Modal title="Salon" onClosed={() => {}}>
        {() => <p>Salon</p>}
      </Modal>
    );
    expect(screen.getByRole("dialog").querySelector(".lyrix-sheet-grip")).toBeNull();
  });

  it("follows the finger down, then slides out and closes once let go far enough", () => {
    const { onClosed, panel, grip } = mount();
    const moves = drag(grip, 100, 300, 600);
    expect(moves.at(-1)?.defaultPrevented).toBe(true);
    // Let go 200px down a 400px sheet: it leaves from where the finger left it.
    const out = animations.find((animation) => String(animation.keyframes[1].transform).includes("100%"));
    expect(out?.keyframes[0].transform).toBe("translate3d(0, 200px, 0)");
    expect(onClosed).not.toHaveBeenCalled();
    finishAll();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(panel.isConnected).toBe(false);
    expect(screen.getByText("Le jeu")).toBeTruthy();
  });

  it("closes on a quick flick, even a short one", () => {
    const { onClosed, grip } = mount();
    drag(grip, 100, 160, 60);
    finishAll();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("springs back from a drag too short, and stays open", () => {
    const { onClosed, panel, grip } = mount();
    drag(grip, 100, 160, 800);
    expect(panel.style.transform).toBe("");
    const back = animations.find((animation) => animation.keyframes[1].transform === "translate3d(0, 0, 0)");
    expect(back?.keyframes[0].transform).toBe("translate3d(0, 60px, 0)");
    finishAll();
    expect(onClosed).not.toHaveBeenCalled();
    expect(panel.isConnected).toBe(true);
  });

  it("can be pulled by its title's row, or its content while scrolled to the top", () => {
    const { panel } = mount();
    const header = panel.querySelector(".lyrix-modal-header");
    const item = screen.getByText("amour");
    expect(canStartDrag(header, panel)).toBe(true);
    expect(canStartDrag(item, panel)).toBe(true);

    // Content scrolled down: the finger scrolls it back up first, never pulls the sheet.
    const body = panel.querySelector(".lyrix-modal-body") as HTMLElement;
    body.scrollTop = 40;
    expect(canStartDrag(item, panel)).toBe(false);
    expect(canStartDrag(header, panel)).toBe(true);
  });

  it("leaves a scroll up and a sideways move to the browser", () => {
    const { onClosed, panel } = mount();
    const item = screen.getByText("amour");
    const up = drag(item, 300, 100, 300);
    expect(up.some((event) => event.defaultPrevented)).toBe(false);
    const sideways = drag(item, 300, 310, 300, { x: 100, toX: 300 });
    expect(sideways.some((event) => event.defaultPrevented)).toBe(false);
    expect(panel.style.transform).toBe("");
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("closes at once under reduced motion, never following the finger", async () => {
    reducedMotion = true;
    const { onClosed, panel, grip } = mount();
    touch("touchstart", 100, 1000, grip);
    touch("touchmove", 200, 1300, grip);
    expect(panel.style.transform).toBe("");
    touch("touchmove", 300, 1600, grip);
    touch("touchend", 300, 1600, grip);
    expect(animations).toEqual([]);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("does nothing in the computer's layout, where a sheet is a dialog", () => {
    phone = false;
    const { onClosed, panel, grip } = mount();
    const moves = drag(grip, 100, 380, 200);
    expect(moves.some((event) => event.defaultPrevented)).toBe(false);
    expect(panel.style.transform).toBe("");
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("leaves a sheet already closing (its ✕) to leave on its own", async () => {
    const { onClosed, grip } = mount();
    act(() => screen.getByRole("button", { name: "Fermer" }).click());
    drag(grip, 100, 380, 200);
    expect(animations).toEqual([]);
    await act(() => new Promise((resolve) => setTimeout(resolve, MODAL_CLOSE_MS + 20)));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});

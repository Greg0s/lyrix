// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { watchKeyboardDismiss } from "../../../src/hooks/keyboardDismiss";

/**
 * Android's Back button closes the keyboard but leaves the guess input
 * focused, and the tab bar, hidden while a field has focus, stayed hidden
 * until the player tapped elsewhere. Under `interactive-widget=resizes-content`
 * the keyboard resizes the page: these tests play it as `innerHeight`.
 */

function resize(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

describe("watchKeyboardDismiss", () => {
  let stop: () => void;
  let input: HTMLInputElement;

  beforeEach(() => {
    resize(412, 860);
    input = document.createElement("input");
    input.type = "text";
    document.body.append(input);
    stop = watchKeyboardDismiss();
    input.focus();
  });

  afterEach(() => {
    stop();
    input.remove();
  });

  it("blurs the focused input once the keyboard goes down", () => {
    resize(412, 520); // keyboard up
    expect(document.activeElement).toBe(input);
    resize(412, 860); // Back: keyboard down, input still focused
    expect(document.activeElement).not.toBe(input);
  });

  it("keeps focus while the keyboard stays up", () => {
    resize(412, 520);
    resize(412, 500); // its suggestion strip comes and goes
    resize(412, 520);
    expect(document.activeElement).toBe(input);
  });

  it("ignores the address bar coming and going", () => {
    resize(412, 804);
    resize(412, 860);
    expect(document.activeElement).toBe(input);
  });

  it("ignores a turn of the phone", () => {
    resize(412, 520);
    resize(860, 412); // turned, keyboard up or not: measured anew
    resize(860, 412);
    expect(document.activeElement).toBe(input);
  });

  it("leaves anything but a text field focused", () => {
    resize(412, 520);
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    resize(412, 860);
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it("does nothing once stopped", () => {
    stop();
    resize(412, 520);
    resize(412, 860);
    expect(document.activeElement).toBe(input);
  });
});

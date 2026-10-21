// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoomMembers } from "../../../src/components/RoomMembers";
import type { RoomMember } from "../../../src/game/room";
import type { RoomView } from "../../../src/hooks/useRoom";

/** A long pseudo is cut by an ellipsis on the Salon card's narrow grid: hovering it with a mouse shows it whole. */

const host: RoomMember = { id: "host", name: "Mademoiselle_K.", number: 1 };
const room: RoomView = { code: "ABCDEF", you: "host", host, members: [host], connected: true };

/** jsdom lays nothing out: give the name the widths a browser would. */
function sized(element: HTMLElement, scrollWidth: number, clientWidth: number): HTMLElement {
  Object.defineProperty(element, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(element, "clientWidth", { configurable: true, value: clientWidth });
  return element;
}

function nameTip(): HTMLElement | null {
  return document.body.querySelector(".lyrix-name-tip");
}

afterEach(cleanup);

describe("a member's name", () => {
  it("shows in full in a tip of the player's colour when it is cut short, until the mouse leaves", () => {
    render(<RoomMembers room={room} variant="grid" />);
    const name = sized(screen.getByText("Mademoiselle_K."), 140, 80);
    fireEvent.pointerEnter(name, { pointerType: "mouse" });
    const tip = nameTip();
    expect(tip?.textContent).toBe("Mademoiselle_K.");
    expect(tip?.getAttribute("aria-hidden")).toBe("true");
    expect(tip?.style.getPropertyValue("--player")).not.toBe("");
    // Outside the card's scrolling grid, which would clip it.
    expect(name.contains(tip)).toBe(false);
    fireEvent.pointerLeave(name, { pointerType: "mouse" });
    expect(nameTip()).toBeNull();
  });

  it("gets no tip when it fits", () => {
    render(<RoomMembers room={room} variant="list" />);
    const name = sized(screen.getByText("Mademoiselle_K."), 140, 140);
    fireEvent.pointerEnter(name, { pointerType: "mouse" });
    expect(nameTip()).toBeNull();
  });

  it("gets no tip from a touch, which has no hover to end it", () => {
    render(<RoomMembers room={room} variant="grid" />);
    const name = sized(screen.getByText("Mademoiselle_K."), 140, 80);
    fireEvent.pointerEnter(name, { pointerType: "touch" });
    expect(nameTip()).toBeNull();
  });

  it("hides its tip when the page scrolls, which would leave it behind", () => {
    render(<RoomMembers room={room} variant="grid" />);
    const name = sized(screen.getByText("Mademoiselle_K."), 140, 80);
    fireEvent.pointerEnter(name, { pointerType: "mouse" });
    fireEvent.scroll(document.querySelector(".lyrix-members") as HTMLElement);
    expect(nameTip()).toBeNull();
  });
});

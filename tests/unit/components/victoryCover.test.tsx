// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VictoryCover } from "../../../src/components/VictoryCover";

afterEach(cleanup);

function sleeve(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(".lyrix-victory-cover");
}

describe("VictoryCover", () => {
  it("shows the cover once it has loaded, and nothing in its place before", () => {
    const { container } = render(<VictoryCover cover="abc" />);
    // Rendered, so the image loads, but hidden (game.css) until it has: no placeholder.
    expect(sleeve(container)?.classList.contains("has-image")).toBe(false);
    expect(sleeve(container)?.textContent).toBe("");

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toMatch(/\/api\/cover\/abc$/);
    fireEvent.load(image as HTMLImageElement);
    expect(sleeve(container)?.classList.contains("has-image")).toBe(true);
  });

  it("goes away entirely when there is no cover to be had", () => {
    const { container } = render(<VictoryCover cover="abc" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(sleeve(container)).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing, and asks for nothing, for a song that can't have a cover", () => {
    const { container } = render(<VictoryCover />);
    expect(container.innerHTML).toBe("");
  });

  it("waits for another song's own cover before showing it", () => {
    const { container, rerender } = render(<VictoryCover cover="abc" />);
    fireEvent.load(container.querySelector("img") as HTMLImageElement);
    rerender(<VictoryCover cover="def" />);
    expect(sleeve(container)?.classList.contains("has-image")).toBe(false);
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/\/api\/cover\/def$/);
  });

  it("is hidden from screen readers: the panel's text names the song", () => {
    const { container } = render(<VictoryCover cover="abc" />);
    expect(sleeve(container)?.getAttribute("aria-hidden")).toBe("true");
  });
});

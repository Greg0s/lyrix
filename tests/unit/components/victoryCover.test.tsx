// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VictoryCover } from "../../../src/components/VictoryCover";

afterEach(cleanup);

function sleeve(container: HTMLElement): HTMLElement {
  const element = container.querySelector<HTMLElement>(".lyrix-victory-cover");
  if (!element) throw new Error("no sleeve");
  return element;
}

describe("VictoryCover", () => {
  it("shows the year on its sleeve until the cover has loaded, then the cover", () => {
    const { container } = render(<VictoryCover cover="abc" year={1996} />);
    expect(sleeve(container).textContent).toBe("1996");
    expect(sleeve(container).classList.contains("has-image")).toBe(false);

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toMatch(/\/api\/cover\/abc$/);
    fireEvent.load(image as HTMLImageElement);
    expect(sleeve(container).classList.contains("has-image")).toBe(true);
  });

  it("keeps its sleeve when there is no cover to be had", () => {
    const { container } = render(<VictoryCover cover="abc" year={1996} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(sleeve(container).classList.contains("has-image")).toBe(false);
    expect(sleeve(container).textContent).toBe("1996");
  });

  it("asks for nothing for a song that can't have a cover", () => {
    const { container } = render(<VictoryCover year={1996} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows another song's sleeve until that song's own cover has loaded", () => {
    const { container, rerender } = render(<VictoryCover cover="abc" year={1996} />);
    fireEvent.load(container.querySelector("img") as HTMLImageElement);
    rerender(<VictoryCover cover="def" year={2014} />);
    expect(sleeve(container).classList.contains("has-image")).toBe(false);
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/\/api\/cover\/def$/);
  });

  it("is hidden from screen readers: the panel's text says the artist and year", () => {
    const { container } = render(<VictoryCover cover="abc" year={1996} />);
    expect(sleeve(container).getAttribute("aria-hidden")).toBe("true");
  });
});

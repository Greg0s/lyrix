// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VictoryPreview } from "../../../src/components/VictoryPreview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no media playback: play() and pause() only fire their events, as a browser would.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  });
});

function parts(container: HTMLElement) {
  return {
    root: container.querySelector<HTMLElement>(".lyrix-preview"),
    audio: container.querySelector("audio") as HTMLAudioElement,
    record: container.querySelector<HTMLButtonElement>(".lyrix-vinyl"),
  };
}

describe("VictoryPreview", () => {
  it("asks the Worker for the extract, never Deezer, and plays nothing unasked", () => {
    const { container } = render(<VictoryPreview cover="abc" />);
    const { audio } = parts(container);
    expect(audio.getAttribute("src")).toMatch(/\/api\/preview\/abc$/);
    expect(audio.autoplay).toBe(false);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("shows the record only once the extract is known to be there", () => {
    const { container } = render(<VictoryPreview cover="abc" />);
    expect(parts(container).root?.classList.contains("is-ready")).toBe(false);
    fireEvent.loadedMetadata(parts(container).audio);
    expect(parts(container).root?.classList.contains("is-ready")).toBe(true);
  });

  it("goes away entirely when there is no extract to be had", () => {
    const { container } = render(<VictoryPreview cover="abc" />);
    fireEvent.error(parts(container).audio);
    expect(container.innerHTML).toBe("");
  });

  it("plays and pauses from the record, and says which it will do", () => {
    const { container } = render(<VictoryPreview cover="abc" />);
    fireEvent.loadedMetadata(parts(container).audio);
    const { record } = parts(container);
    expect(record?.getAttribute("aria-label")).toBe("Écouter un extrait de 30 secondes");

    fireEvent.click(record as HTMLButtonElement);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(parts(container).root?.classList.contains("is-playing")).toBe(true);
    expect(record?.getAttribute("aria-label")).toBe("Mettre l'extrait en pause");

    fireEvent.click(record as HTMLButtonElement);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(parts(container).root?.classList.contains("is-playing")).toBe(false);
  });

  it("shows the time played without re-rendering anything", () => {
    let renders = 0;
    const { container } = render(
      <Profiler id="preview" onRender={() => renders++}>
        <VictoryPreview cover="abc" />
      </Profiler>
    );
    const { audio, root } = parts(container);
    fireEvent.loadedMetadata(audio);
    Object.defineProperty(audio, "duration", { configurable: true, value: 30 });
    const before = renders;
    for (const time of [3, 6, 12]) {
      Object.defineProperty(audio, "currentTime", { configurable: true, value: time });
      fireEvent.timeUpdate(audio);
    }
    expect(renders).toBe(before);
    expect(root?.style.getPropertyValue("--progress")).toBe("0.4");
  });

  it("starts another song's extract paused", () => {
    const { container, rerender } = render(<VictoryPreview cover="abc" />);
    fireEvent.loadedMetadata(parts(container).audio);
    fireEvent.click(parts(container).record as HTMLButtonElement);
    rerender(<VictoryPreview cover="def" />);
    expect(parts(container).root?.classList.contains("is-playing")).toBe(false);
    expect(parts(container).root?.classList.contains("is-ready")).toBe(false);
    expect(parts(container).audio.getAttribute("src")).toMatch(/\/api\/preview\/def$/);
  });
});

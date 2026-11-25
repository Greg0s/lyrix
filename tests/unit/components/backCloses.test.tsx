// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal, MODAL_CLOSE_MS } from "../../../src/components/Modal";
import { isLayerEntry } from "../../../src/hooks/useBackCloses";

/**
 * Android's Back button closes a dialog or a sheet, as in an installed app
 * (useBackCloses): it used to go to the screen before, behind the sheet still
 * open, or to leave the app.
 */

function Screen() {
  const [open, setOpen] = useState(true);
  return open ? (
    <Modal title="Tes mots" variant="sheet" onClosed={() => setOpen(false)}>
      {() => <p>Les mots</p>}
    </Modal>
  ) : (
    <p>Le jeu</p>
  );
}

/** Back, as the browser does it: the entry goes, then popstate, a task later. */
async function goBack(): Promise<void> {
  await act(async () => {
    const popped = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
    window.history.back();
    await popped;
  });
}

async function closingDone(): Promise<void> {
  await act(() => new Promise((resolve) => setTimeout(resolve, MODAL_CLOSE_MS + 20)));
  // The entry taken back off, in a microtask, then the browser's own task.
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

describe("Back over a dialog", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("closes it, and leaves the screen under it where it was", async () => {
    render(<Screen />);
    expect(isLayerEntry(window.history.state)).toBe(true);

    await goBack();
    await closingDone();
    expect(screen.getByText("Le jeu")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.pathname).toBe("/");
    expect(isLayerEntry(window.history.state)).toBe(false);
  });

  it("takes its entry back off once closed another way, so Back goes where it would have", async () => {
    render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await closingDone();
    expect(screen.getByText("Le jeu")).toBeTruthy();
    expect(isLayerEntry(window.history.state)).toBe(false);
  });

  it("takes one entry only under StrictMode's double mount", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const back = vi.spyOn(window.history, "back");
    render(
      <StrictMode>
        <Screen />
      </StrictMode>
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(isLayerEntry(window.history.state)).toBe(true);
  });
});

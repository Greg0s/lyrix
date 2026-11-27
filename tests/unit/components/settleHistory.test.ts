// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { settleHistory } from "./settleHistory";

describe("settleHistory", () => {
  it("waits out a Back on its way, popstate included", async () => {
    window.history.replaceState(null, "", "/");
    window.history.pushState(null, "", "/jouer-a-plusieurs");
    let popped = false;
    window.addEventListener("popstate", () => (popped = true), { once: true });

    window.history.back();
    await settleHistory();

    expect(popped).toBe(true);
    expect(window.location.pathname).toBe("/");
  });
});

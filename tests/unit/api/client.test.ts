import { afterEach, describe, expect, it, vi } from "vitest";
import { submitGuess } from "../../../src/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitGuess", () => {
  // Without the flag, the Worker answers with the whole round, as it does for
  // a tab still running a build from before deltas.
  it("asks for what the guess changed rather than the whole round", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await submitGuess("state-0", "pluie");

    const init = (fetchMock.mock.calls[0] as unknown[] | undefined)?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toEqual({ state: "state-0", word: "pluie", delta: true });
  });
});

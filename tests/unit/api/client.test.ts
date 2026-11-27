import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, UnknownWordError } from "../../../src/api/base";
import { submitGuess } from "../../../src/api/client";
import { submitRoomGuess } from "../../../src/api/rooms";

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

describe("a word the Worker doesn't know", () => {
  const unknown = { error: "Je ne connais pas le mot « Azerty ».", code: "unknown-word", key: "azerty" };

  it("is an UnknownWordError carrying its key, solo and in a room alike", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(unknown), { status: 422 })));
    // The room's address is made from the page's, when no API origin is configured.
    vi.stubGlobal("window", { location: { origin: "http://localhost" } });

    const solo = await submitGuess("state-0", "Azerty").catch((error: unknown) => error);
    expect(solo).toBeInstanceOf(UnknownWordError);
    expect((solo as UnknownWordError).key).toBe("azerty");
    const room = await submitRoomGuess("ABC234", "t", "Azerty").catch((error: unknown) => error);
    expect(room).toBeInstanceOf(UnknownWordError);
  });

  it("is told apart from any other refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 422 })));

    const error = await submitGuess("state-0", "Azerty").catch((caught: unknown) => caught);
    expect(error).not.toBeInstanceOf(UnknownWordError);
    expect(error).toBeInstanceOf(ApiError);
  });
});

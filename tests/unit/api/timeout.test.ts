import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUESS_TIMEOUT_MS, ROOM_ENTRY_TIMEOUT_MS, ROUND_LOAD_TIMEOUT_MS } from "../../../src/api/base";

// A request a phone's flaky network leaves hanging used to never settle: the
// dock refuses a new guess while one is in flight, so the game stopped
// answering for good, without a word of why.

async function loadApi() {
  vi.stubEnv("VITE_API_BASE_URL", "https://lyrix-api.lyrix.workers.dev");
  vi.resetModules();
  return { ...(await import("../../../src/api/client")), ...(await import("../../../src/api/rooms")) };
}

/** A network that never answers, until the request is aborted. */
function hangingFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        })
    )
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const guesses = {
  "a solo guess": (api: Awaited<ReturnType<typeof loadApi>>) => api.submitGuess("state", "pluie"),
  "a room's guess": (api: Awaited<ReturnType<typeof loadApi>>) => api.submitRoomGuess("ABC234", "token", "pluie"),
};

describe.each(Object.entries(guesses))("%s", (_name, send) => {
  it("gives up once the network has kept it waiting too long", async () => {
    const api = await loadApi();
    hangingFetch();
    const sent = send(api);
    const outcome = expect(sent).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(GUESS_TIMEOUT_MS - 1);
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
  });

  it("leaves no timer behind once answered", async () => {
    const api = await loadApi();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));

    await expect(send(api)).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});

type Api = Awaited<ReturnType<typeof loadApi>>;

const loads = {
  "today's round": (api: Api, signal?: AbortSignal) => api.fetchRound(signal),
  "a resumed round": (api: Api, signal?: AbortSignal) => api.resumeRound(["state"], "2026-10-05", signal),
};

describe.each(Object.entries(loads))("loading %s", (_name, load) => {
  it("gives up once the network has kept it waiting too long, as a timeout", async () => {
    const api = await loadApi();
    hangingFetch();
    const outcome = expect(load(api)).rejects.toMatchObject({ name: "TimeoutError" });

    await vi.advanceTimersByTimeAsync(ROUND_LOAD_TIMEOUT_MS - 1);
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
  });

  // useGame drops a superseded load quietly, but tells the player about a timeout.
  it("is still cancelled by its caller, as an abort rather than a timeout", async () => {
    const api = await loadApi();
    hangingFetch();
    const caller = new AbortController();
    const outcome = expect(load(api, caller.signal)).rejects.toMatchObject({ name: "AbortError" });

    caller.abort();
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });
});

const entries = {
  "creating a room": (api: Api) => api.createRoom("Camille"),
  "joining a room": (api: Api) => api.joinRoom("ABC234", "Camille"),
};

describe.each(Object.entries(entries))("%s", (_name, enter) => {
  it("says the rooms are unavailable once the network has kept it waiting too long", async () => {
    const api = await loadApi();
    hangingFetch();
    const result = enter(api);

    await vi.advanceTimersByTimeAsync(ROOM_ENTRY_TIMEOUT_MS);
    expect(await result).toEqual({ ok: false, failure: "unavailable" });
  });
});

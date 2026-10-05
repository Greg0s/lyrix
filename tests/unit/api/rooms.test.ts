import { afterEach, describe, expect, it, vi } from "vitest";

// Pages and the Worker are on different origins in production (see
// docs/LEARNINGS.md, 2026-09-12), so the room's WebSocket has to go to the
// Worker's own host, over wss, not to the page's.
async function loadRoomsApi(apiBase: string) {
  vi.stubEnv("VITE_API_BASE_URL", apiBase);
  vi.resetModules();
  return import("../../../src/api/rooms");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The socket URL without its tab, which is random: checked on its own below. */
function withoutTab(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("tab");
  return parsed.toString();
}

describe("roomSocketUrl", () => {
  it("reaches the deployed Worker over wss", async () => {
    const { roomSocketUrl } = await loadRoomsApi("https://lyrix-api.lyrix.workers.dev");

    expect(withoutTab(roomSocketUrl("ABC234", "a token"))).toBe(
      "wss://lyrix-api.lyrix.workers.dev/api/rooms/ABC234/ws?token=a+token"
    );
  });

  it("stays on ws against a local Worker", async () => {
    const { roomSocketUrl } = await loadRoomsApi("http://localhost:8787");

    expect(withoutTab(roomSocketUrl("ABC234", "t"))).toBe("ws://localhost:8787/api/rooms/ABC234/ws?token=t");
  });

  // The room spares this tab's socket the broadcast of its own guesses (whose
  // answer already carries the round), so both must name the same tab.
  it("names the page's tab, the same one its guesses do", async () => {
    const { roomSocketUrl, submitRoomGuess } = await loadRoomsApi("http://localhost:8787");
    const fetchMock = vi.fn(async () => new Response("null", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const tab = new URL(roomSocketUrl("ABC234", "t")).searchParams.get("tab");
    await submitRoomGuess("ABC234", "t", "vent").catch(() => {});

    expect(tab).toMatch(/^[0-9a-f]{32}$/);
    expect(new URL(roomSocketUrl("ABC234", "t")).searchParams.get("tab")).toBe(tab);
    const init = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit];
    expect(JSON.parse(String(init[1].body))).toMatchObject({ tab });
    vi.unstubAllGlobals();
  });
});

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

describe("roomSocketUrl", () => {
  it("reaches the deployed Worker over wss", async () => {
    const { roomSocketUrl } = await loadRoomsApi("https://lyrix-api.lyrix.workers.dev");

    expect(roomSocketUrl("ABC234", "a token")).toBe(
      "wss://lyrix-api.lyrix.workers.dev/api/rooms/ABC234/ws?token=a+token"
    );
  });

  it("stays on ws against a local Worker", async () => {
    const { roomSocketUrl } = await loadRoomsApi("http://localhost:8787");

    expect(roomSocketUrl("ABC234", "t")).toBe("ws://localhost:8787/api/rooms/ABC234/ws?token=t");
  });
});

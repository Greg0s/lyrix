import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "vite";
import { apiPreconnectTags } from "../../../scripts/lib/apiPreconnect";

/**
 * In production the API is on the Worker's own origin, so its first call (the
 * day's round) used to open a connection only once the app had mounted.
 * index.html now opens it early - only when the API is on another origin.
 */

const root = new URL("../../../", import.meta.url);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the API's preconnect", () => {
  it("names the API's origin alone, in CORS mode like the requests that use it", () => {
    expect(apiPreconnectTags("https://lyrix-api.lyrix.workers.dev/some/path")).toEqual([
      {
        tag: "link",
        attrs: { rel: "preconnect", href: "https://lyrix-api.lyrix.workers.dev", crossorigin: true },
        injectTo: "head",
      },
    ]);
  });

  // Dev and e2e reach the API through Vite's proxy, on the page's own origin.
  it("is left out when the API is same-origin, or its URL unreadable", () => {
    expect(apiPreconnectTags(undefined)).toEqual([]);
    expect(apiPreconnectTags("")).toEqual([]);
    expect(apiPreconnectTags("not a url")).toEqual([]);
  });

  it("is in the built index.html when the build names the API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://lyrix-api.lyrix.workers.dev");
    const result = await build({ root: fileURLToPath(root), logLevel: "silent", build: { write: false } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("expected a single, unwatched build");
    const built = result.output.find((file) => file.fileName === "index.html");
    if (built?.type !== "asset") throw new Error("no index.html in the build");

    expect(String(built.source)).toContain('<link rel="preconnect" href="https://lyrix-api.lyrix.workers.dev" crossorigin>');
  }, 60_000);
});

import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "vite";
import { UMAMI_SCRIPT_URL, UMAMI_WEBSITE_ID, umamiTags } from "../../../scripts/lib/umami";

/**
 * Umami counts visits on the deployed site only: dev, e2e and a local preview
 * (no VITE_API_BASE_URL) never load it, so they never count a visit nor ask
 * another host for anything (tests/e2e/privacy.spec.ts).
 */

const root = new URL("../../../", import.meta.url);

afterEach(() => {
  vi.unstubAllEnvs();
});

async function builtIndexHtml(): Promise<string> {
  const result = await build({ root: fileURLToPath(root), logLevel: "silent", build: { write: false } });
  if (Array.isArray(result) || !("output" in result)) throw new Error("expected a single, unwatched build");
  const built = result.output.find((file) => file.fileName === "index.html");
  if (built?.type !== "asset") throw new Error("no index.html in the build");
  return String(built.source);
}

describe("Umami", () => {
  it("is left out when the build doesn't name the production API", () => {
    expect(umamiTags(undefined)).toEqual([]);
    expect(umamiTags("")).toEqual([]);
  });

  it("is in the production build's head, deferred, for the site's domain only, honouring Do Not Track", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://lyrix-api.lyrix.workers.dev");
    const html = await builtIndexHtml();
    const head = html.slice(0, html.indexOf("</head>"));

    expect(head).toContain(
      `<script defer src="${UMAMI_SCRIPT_URL}" data-website-id="${UMAMI_WEBSITE_ID}" data-domains="lyrix.mintymoon.app" data-do-not-track="true"></script>`
    );
  }, 60_000);

  it("is not in a build without the production API (e2e, local preview)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    expect(await builtIndexHtml()).not.toContain(UMAMI_SCRIPT_URL);
  }, 60_000);
});

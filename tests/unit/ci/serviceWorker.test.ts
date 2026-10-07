import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRECACHED_PUBLIC_FILES, precacheFor, type BuiltFile } from "../../../scripts/lib/serviceWorker";
import { registerServiceWorker } from "../../../src/pwa";
import { SERVICE_WORKER_PATH } from "../../../src/serviceWorker/routes";

/**
 * How the service worker (#79) is built, served and registered. What it does
 * once running is tests/unit/serviceWorker's, and the e2e suite's
 * (tests/e2e/pwa.spec.ts).
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));

const index: BuiltFile = { fileName: "index.html", content: "<html>v1</html>" };
const built: BuiltFile[] = [
  index,
  { fileName: "salon/index.html", content: "<html>invite</html>" },
  { fileName: "assets/index-abc.js", content: "app" },
  { fileName: "assets/index-def.css", content: "styles" },
];
const publicFiles: BuiltFile[] = [{ fileName: "icon-192.png", content: new Uint8Array([1, 2, 3]) }];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the service worker's file list", () => {
  it("keeps the app shell, the bundled scripts and styles, and the shell's public files", () => {
    expect(precacheFor(index, built, publicFiles).urls).toEqual([
      "/",
      "/assets/index-abc.js",
      "/assets/index-def.css",
      "/icon-192.png",
    ]);
  });

  it("changes version with anything it keeps, and only then", () => {
    const { version } = precacheFor(index, built, publicFiles);
    expect(precacheFor(index, built, publicFiles).version).toBe(version);
    expect(precacheFor({ ...index, content: "<html>v2</html>" }, built, publicFiles).version).not.toBe(version);
    expect(precacheFor(index, built, [{ fileName: "icon-192.png", content: new Uint8Array([3]) }]).version).not.toBe(version);
    expect(
      precacheFor(index, [...built.slice(0, 2), { fileName: "assets/index-xyz.js", content: "app" }], publicFiles).version
    ).not.toBe(version);
    // The invite page isn't kept: it changing installs no new worker.
    expect(precacheFor(index, [index, { fileName: "salon/index.html", content: "?" }, ...built.slice(2)], publicFiles).version).toBe(
      version
    );
  });

  it("names public files that exist: the manifest and the icons it and index.html use, not the link previews", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest").toString("utf8")) as { icons: { src: string }[] };
    expect(PRECACHED_PUBLIC_FILES).toEqual(
      expect.arrayContaining(["manifest.webmanifest", "favicon.svg", ...manifest.icons.map((icon) => icon.src.slice(1))])
    );
    for (const file of PRECACHED_PUBLIC_FILES) expect(existsSync(new URL(`public/${file}`, root)), file).toBe(true);
    expect(PRECACHED_PUBLIC_FILES.some((file) => file.startsWith("og-"))).toBe(false);
  });
});

describe("the built service worker", () => {
  it("is emitted by the build as a classic script, holding this build's file list", async () => {
    const result = await build({ root: fileURLToPath(root), logLevel: "silent", build: { write: false } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("expected a single, unwatched build");
    const files = new Map(result.output.map((file) => [file.fileName, file]));
    const worker = files.get(SERVICE_WORKER_PATH.slice(1));
    expect(worker?.type).toBe("asset");
    if (worker?.type !== "asset") return;
    const code = String(worker.source);

    // A module worker isn't supported everywhere: no import or export may survive the build.
    expect(code).toMatch(/^\(function\(\)\{/);
    expect(code).not.toMatch(/(^|[;}\s])(import|export)[\s{*]/);
    expect(code).not.toContain("__LYRIX_PRECACHE__");
    const list = /urls:\[([^\]]*)\]/.exec(code)?.[1] ?? "";
    const urls = [...list.matchAll(/[`"']([^`"']+)[`"']/g)].map(([, url]) => url);
    const assets = [...files.keys()].filter((name) => name.startsWith("assets/")).map((name) => `/${name}`);
    expect(assets.length).toBeGreaterThan(0);
    expect(urls.sort()).toEqual(["/", ...assets, ...PRECACHED_PUBLIC_FILES.map((file) => `/${file}`)].sort());
  }, 60_000);

  it("is never kept by a cache on its way from Pages", () => {
    const rules = read("public/_headers")
      .toString("utf8")
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
    const at = rules.indexOf(SERVICE_WORKER_PATH);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(rules[at + 1]).toMatch(/^\s+Cache-Control: no-cache$/);
  });
});

/** A window as registerServiceWorker sees it. */
function fakeWindow({ readyState = "loading", supported = true, fails = false } = {}) {
  const listeners = new Map<string, () => void>();
  const register = vi.fn(() => (fails ? Promise.reject(new Error("refused")) : Promise.resolve()));
  const win = {
    navigator: supported ? { serviceWorker: { register } } : {},
    document: { readyState },
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
  } as unknown as Window;
  return { win, register, load: () => listeners.get("load")?.() };
}

describe("registering the service worker", () => {
  it("waits for the page to have loaded", () => {
    const { win, register, load } = fakeWindow();
    registerServiceWorker(win);
    expect(register).not.toHaveBeenCalled();
    load();
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_PATH);
  });

  it("registers at once on a page already loaded", () => {
    const { win, register } = fakeWindow({ readyState: "complete" });
    registerServiceWorker(win);
    expect(register).toHaveBeenCalledWith(SERVICE_WORKER_PATH);
  });

  it("leaves a browser without service workers, or one that refuses it, playing as before", async () => {
    expect(() => registerServiceWorker(fakeWindow({ supported: false, readyState: "complete" }).win)).not.toThrow();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerServiceWorker(fakeWindow({ readyState: "complete", fails: true }).win);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });

  it("only happens in a production build", () => {
    expect(read("src/main.tsx").toString("utf8")).toContain("if (import.meta.env.PROD) registerServiceWorker();");
  });
});

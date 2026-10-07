import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NAVIGATION_TIMEOUT_MS, type Precache } from "../../../src/serviceWorker/routes";

/**
 * The service worker's event handlers (src/serviceWorker/sw.ts, #79), run
 * against a fake worker scope, Cache Storage and network. tests/e2e/pwa.spec.ts
 * runs the built worker in a browser.
 */

const ORIGIN = "https://lyrix.test";
const PRECACHE: Precache = { version: "v2", urls: ["/", "/assets/index-abc.js", "/icon-192.png"] };
const SHELL_CACHE = "lyrix-shell-v2";
const FONT_CACHE = "lyrix-fonts-v2";
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Figtree&display=swap";
const FONT_FILE = "https://fonts.gstatic.com/s/figtree/v5/abc.woff2";

const absolute = (input: RequestInfo | URL) => new URL(input instanceof Request ? input.url : String(input), ORIGIN).toString();

class FakeCache {
  readonly entries = new Map<string, Response>();
  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(absolute(request))?.clone();
  }
  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(absolute(request), response);
  }
}

class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();
  async open(name: string): Promise<FakeCache> {
    const cache = this.caches.get(name) ?? new FakeCache();
    this.caches.set(name, cache);
    return cache;
  }
  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }
  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
}

type Listener = (event: unknown) => void;

/** What the network answers, by absolute URL; a URL left out fails like a request with no network. */
let network: Map<string, () => Promise<Response>>;
let storage: FakeCacheStorage;
let listeners: Map<string, Listener>;
let scope: { skipWaiting: () => Promise<void>; clients: { claim: () => Promise<void> } };
const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const answer = network.get(absolute(input));
  if (!answer) throw new TypeError("Failed to fetch");
  return answer();
});

function serve(url: string, body: string, init?: ResponseInit) {
  network.set(absolute(url), async () => new Response(body, init));
}

function goOffline() {
  network.clear();
}

/** Runs a lifecycle event (install, activate) to its end. */
async function lifecycle(type: "install" | "activate"): Promise<void> {
  const pending: Promise<unknown>[] = [];
  listeners.get(type)?.({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
  await Promise.all(pending);
}

/** A request as a page makes it; `navigate` for a page's address, which no Request constructor accepts. */
function request(url: string, { method = "GET", navigate = false }: { method?: string; navigate?: boolean } = {}): Request {
  const made = new Request(absolute(url), { method });
  if (navigate) Object.defineProperty(made, "mode", { value: "navigate" });
  return made;
}

/** Dispatches a fetch event: the worker's answer, or null when it leaves the request to the browser. */
function fetchEvent(made: Request): { answer: Promise<Response> | null; settled: () => Promise<unknown> } {
  let answer: Promise<Response> | null = null;
  const pending: Promise<unknown>[] = [];
  listeners.get("fetch")?.({
    request: made,
    respondWith: (response: Promise<Response>) => {
      answer = response;
    },
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
  });
  return { answer, settled: () => Promise.all(pending) };
}

async function answerText(made: Request): Promise<string> {
  const { answer } = fetchEvent(made);
  if (!answer) throw new Error(`the worker left ${made.url} to the browser`);
  return (await answer).text();
}

async function installed(): Promise<void> {
  await lifecycle("install");
  await lifecycle("activate");
  fetchMock.mockClear();
}

beforeEach(async () => {
  network = new Map();
  storage = new FakeCacheStorage();
  listeners = new Map();
  scope = { skipWaiting: vi.fn(async () => {}), clients: { claim: vi.fn(async () => {}) } };
  fetchMock.mockClear();
  serve("/", "<!doctype html><title>Lyrix shell</title>");
  serve("/assets/index-abc.js", "console.log('app')");
  serve("/icon-192.png", "png");
  vi.stubGlobal("self", {
    ...scope,
    location: new URL("/sw.js", ORIGIN),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  });
  vi.stubGlobal("caches", storage);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("__LYRIX_PRECACHE__", PRECACHE);
  vi.resetModules();
  await import("../../../src/serviceWorker/sw");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the service worker", () => {
  it("keeps this build's files on install, fetched past the HTTP cache, then takes over at once", async () => {
    await lifecycle("install");

    expect([...(storage.caches.get(SHELL_CACHE)?.entries.keys() ?? [])].sort()).toEqual(
      PRECACHE.urls.map((url) => absolute(url)).sort()
    );
    for (const url of PRECACHE.urls) expect(fetchMock).toHaveBeenCalledWith(url, { cache: "reload" });
    expect(scope.skipWaiting).toHaveBeenCalledOnce();
  });

  it("fails its install when a file is missing, so the version before stays in charge", async () => {
    serve("/icon-192.png", "not found", { status: 404 });

    await expect(lifecycle("install")).rejects.toThrow(/icon-192\.png: HTTP 404/);
    expect(scope.skipWaiting).not.toHaveBeenCalled();
  });

  it("deletes every other version's caches once in charge, and takes the open pages", async () => {
    for (const name of ["lyrix-shell-v1", "lyrix-fonts-v1", SHELL_CACHE, FONT_CACHE, "another-app"]) await storage.open(name);

    await lifecycle("activate");

    expect((await storage.keys()).sort()).toEqual(["another-app", FONT_CACHE, SHELL_CACHE].sort());
    expect(scope.clients.claim).toHaveBeenCalledOnce();
  });

  it("leaves the API, invite links and anything but a GET to the browser", async () => {
    await installed();

    for (const made of [
      request("/api/round"),
      request("/api/round?day=2026-10-01"),
      request("/api/guess", { method: "POST" }),
      request("https://lyrix-api.lyrix.workers.dev/api/round"),
      request("/salon/ABCDEF", { navigate: true }),
      request("/archives", { method: "POST", navigate: true }),
    ]) {
      expect(fetchEvent(made).answer, made.url).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never keeps an API response", async () => {
    await installed();
    serve("/api/round", "{}");

    fetchEvent(request("/api/round"));
    fetchEvent(request("/api/round", { navigate: true }));

    for (const cache of storage.caches.values()) {
      for (const url of cache.entries.keys()) expect(url).not.toContain("/api/");
    }
  });

  it("answers a page's address from the network when it can", async () => {
    await installed();
    serve("/archives", "fresh page");

    expect(await answerText(request("/archives", { navigate: true }))).toBe("fresh page");
  });

  it("opens the app shell kept on install, offline", async () => {
    await installed();
    goOffline();

    expect(await answerText(request("/archives/2026-10-01", { navigate: true }))).toBe(
      "<!doctype html><title>Lyrix shell</title>"
    );
  });

  it("opens the app shell when the network leaves a page hanging", async () => {
    await installed();
    vi.useFakeTimers();
    network.set(absolute("/"), () => new Promise<Response>(() => {}));

    const { answer } = fetchEvent(request("/", { navigate: true }));
    let settled = false;
    void answer?.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(NAVIGATION_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await (await answer)?.text()).toBe("<!doctype html><title>Lyrix shell</title>");
  });

  it("serves this build's files from the cache, without the network", async () => {
    await installed();
    goOffline();

    expect(await answerText(request("/assets/index-abc.js"))).toBe("console.log('app')");
    expect(await answerText(request("/icon-192.png"))).toBe("png");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the font stylesheet, and refreshes it behind the copy it serves", async () => {
    await installed();
    serve(FONT_CSS, "first");
    expect(await answerText(request(FONT_CSS))).toBe("first");

    serve(FONT_CSS, "second");
    const { answer, settled } = fetchEvent(request(FONT_CSS));
    expect(await (await answer)?.text()).toBe("first");
    await settled();

    goOffline();
    expect(await answerText(request(FONT_CSS))).toBe("second");
  });

  it("keeps a font file once fetched", async () => {
    await installed();
    serve(FONT_FILE, "woff2");
    expect(await answerText(request(FONT_FILE))).toBe("woff2");

    goOffline();
    expect(await answerText(request(FONT_FILE))).toBe("woff2");
  });
});

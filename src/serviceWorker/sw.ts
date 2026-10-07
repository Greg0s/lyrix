import {
  CACHE_PREFIX,
  NAVIGATION_TIMEOUT_MS,
  SHELL_URL,
  strategyFor,
  type Precache,
  type Strategy,
} from "./routes";

/**
 * The service worker (#79): keeps this build's app shell (index.html, its
 * scripts and styles, the icons, the manifest) and the web fonts, so the
 * game opens straight away and still opens with no network, where the app
 * says it is offline.
 *
 * Built into /sw.js by scripts/lib/serviceWorker.ts, which writes this
 * build's file list in for __LYRIX_PRECACHE__. Type-checked on its own
 * (./tsconfig.json): it runs in a worker, not a page.
 *
 * It never answers the API or an invite link (routes.ts): a round, a guess
 * or a room always comes from the Worker itself. A page's address is asked
 * of the network first, so a deploy reaches players at their next visit;
 * the app shell kept here only answers when the network can't. A new
 * version takes over as soon as it is installed (skipWaiting, claim), and
 * every other version's caches go with the old one.
 */

declare const self: ServiceWorkerGlobalScope;
declare const __LYRIX_PRECACHE__: Precache;

const { version, urls } = __LYRIX_PRECACHE__;
const SHELL_CACHE = `${CACHE_PREFIX}shell-${version}`;
const FONT_CACHE = `${CACHE_PREFIX}fonts-${version}`;
const precached = new Set(urls);

/** A navigation can't be answered with a redirected response; a copy of its body can. */
async function unredirected(response: Response): Promise<Response> {
  if (!response.redirected) return response;
  const { status, statusText, headers } = response;
  return new Response(await response.blob(), { status, statusText, headers });
}

async function precache(): Promise<void> {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      // Past the HTTP cache: an older copy there would pair this version's shell with another's files.
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`precaching ${url}: HTTP ${response.status}`);
      await cache.put(url, await unredirected(response));
    })
  );
}

self.addEventListener("install", (event) => {
  // A file missing fails the install: the version before stays in charge.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const current = new Set([SHELL_CACHE, FONT_CACHE]);
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && !current.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

/** `promise`, or a rejection once `ms` have passed without it settling. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** An address of the app: the network's answer, whatever it is, or the app shell when there is none in time. */
async function page(request: Request): Promise<Response> {
  const network = fetch(request);
  try {
    return await within(network, NAVIGATION_TIMEOUT_MS);
  } catch {
    const shell = await (await caches.open(SHELL_CACHE)).match(SHELL_URL);
    // Nothing kept (the browser cleared it): the network's own outcome stands.
    return shell ?? network;
  }
}

/** Fetches `request` and keeps the response in `cache`. */
async function fetchAndKeep(cache: Cache, request: Request): Promise<Response> {
  const response = await fetch(request);
  // The font stylesheet is fetched without CORS, so its response is opaque
  // and can't tell an error from a success: kept all the same, and replaced
  // by the next fetch of it.
  if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
  return response;
}

async function fromCache(cacheName: string, request: Request, options?: CacheQueryOptions): Promise<Response> {
  const cache = await caches.open(cacheName);
  return (await cache.match(request, options)) ?? fetchAndKeep(cache, request);
}

async function refreshedInBackground(event: FetchEvent, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const fresh = fetchAndKeep(cache, event.request);
  if (!cached) return fresh;
  event.waitUntil(fresh.catch(() => undefined));
  return cached;
}

function respond(strategy: Exclude<Strategy, "network">, event: FetchEvent): Promise<Response> {
  switch (strategy) {
    case "page":
      return page(event.request);
    case "precached":
      // Kept under its bare address, by a request with no headers a response could vary on.
      return fromCache(SHELL_CACHE, event.request, { ignoreVary: true });
    case "font-stylesheet":
      return refreshedInBackground(event, FONT_CACHE);
    case "font-file":
      return fromCache(FONT_CACHE, event.request);
  }
}

self.addEventListener("fetch", (event) => {
  const strategy = strategyFor(event.request, self.location.origin, precached);
  if (strategy === "network") return;
  event.respondWith(respond(strategy, event));
});

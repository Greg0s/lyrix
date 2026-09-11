import type { Song } from "../../src/game/types";

const CACHE_ORIGIN = "https://lyrix.internal/cache/song/";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // a song's lyrics never change once resolved, so cache generously

function cacheKey(id: string): Request {
  return new Request(CACHE_ORIGIN + encodeURIComponent(id));
}

function isSong(value: unknown): value is Song {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.artist === "string" &&
    Array.isArray(candidate.sections)
  );
}

// The Cache API only exists in the real Workers runtime (production and
// `wrangler dev`), not under plain-Node Vitest. Both helpers no-op outside it
// (degrading to "always fetch fresh") and never throw, so a cache hiccup can
// never break song resolution - caching here is purely an optimization.
export async function getCachedSong(id: string): Promise<Song | null> {
  if (typeof caches === "undefined") return null;
  try {
    const response = await caches.default.match(cacheKey(id));
    if (!response) return null;
    const body: unknown = await response.json().catch(() => null);
    return isSong(body) ? body : null;
  } catch {
    return null;
  }
}

export async function putCachedSong(id: string, song: Song): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const response = new Response(JSON.stringify(song), {
      headers: { "content-type": "application/json", "cache-control": `max-age=${CACHE_TTL_SECONDS}` },
    });
    await caches.default.put(cacheKey(id), response);
  } catch {
    // Best-effort - a failed write just means the next request fetches fresh again.
  }
}

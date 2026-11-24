import { Hono } from "hono";
import { type CoverEnv, getSongMedia, songOfCoverToken } from "./covers";
import { DeezerUnavailableError, fetchDeezerAudio, fetchDeezerPreviewUrl } from "./deezer";

/**
 * A won song's 30-second extract, played on the victory panel
 * (VictoryPreview.tsx): Deezer's preview of the track found with the song's
 * cover (covers.ts, `media:<id>`), fetched by the Worker and served by it, so
 * a player's browser never asks Deezer anything (tests/e2e/privacy.spec.ts).
 *
 * Asked for by the same token as the cover (RoundView.cover), which a view
 * only carries once the round is won. Deezer signs an extract's address for a
 * limited time, so the address is asked for anew whenever the extract isn't
 * in this datacenter's cache; the extract itself is never kept for good.
 *
 * Range requests are answered (206): Safari plays no audio without them.
 */

/** How long an extract may be kept, in this datacenter's cache and the player's browser. */
export const PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 24;
/** How long "no extract" may be kept: a day too, in case Deezer has one later. */
const NO_PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 24;
const PREVIEW_RETRY_AFTER_SECONDS = 30;

const CACHE_ORIGIN = "https://lyrix.internal/cache/preview/";

function cacheKey(id: string): Request {
  return new Request(CACHE_ORIGIN + encodeURIComponent(id));
}

// The Cache API only exists in the Workers runtime: under plain-Node Vitest,
// every extract is fetched afresh. A cache hiccup never fails a request.
async function cachedAudio(id: string): Promise<ArrayBuffer | null> {
  if (typeof caches === "undefined") return null;
  try {
    const response = await caches.default.match(cacheKey(id));
    return response ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function cacheAudio(id: string, bytes: ArrayBuffer): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.default.put(
      cacheKey(id),
      new Response(bytes, {
        headers: { "content-type": "audio/mpeg", "cache-control": `max-age=${PREVIEW_MAX_AGE_SECONDS}` },
      })
    );
  } catch {
    // Best-effort: the next request asks Deezer again.
  }
}

/** A song's extract: from this datacenter's cache, then Deezer. Null when Deezer has none. */
async function previewAudio(id: string, env: CoverEnv): Promise<ArrayBuffer | null> {
  const cached = await cachedAudio(id);
  if (cached) return cached;
  const media = await getSongMedia(id, env);
  if (!media?.deezer) return null;
  const url = await fetchDeezerPreviewUrl(id, media.deezer.trackId);
  if (url === null) return null;
  const bytes = await fetchDeezerAudio(id, url);
  await cacheAudio(id, bytes);
  return bytes;
}

/** The byte range a `Range` header asks for, within `size` bytes: null for the whole, "unsatisfiable" past its end. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "unsatisfiable" {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  // Several ranges, or another unit: the whole body, as RFC 9110 allows.
  if (!match || (match[1] === "" && match[2] === "")) return null;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || end < start) return "unsatisfiable";
  return { start, end };
}

function audioResponse(bytes: ArrayBuffer, rangeHeader: string | null): Response {
  const size = bytes.byteLength;
  const headers = new Headers({
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": `public, max-age=${PREVIEW_MAX_AGE_SECONDS}`,
  });
  const range = parseRange(rangeHeader, size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range === null) {
    headers.set("Content-Length", String(size));
    return new Response(bytes, { headers });
  }
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  headers.set("Content-Length", String(range.end - range.start + 1));
  return new Response(bytes.slice(range.start, range.end + 1), { status: 206, headers });
}

export const previewRoutes = new Hono<{ Bindings: CoverEnv }>();

// GET /api/preview/<token>: a won round's extract. An unknown token and a
// song without an extract get the same 404, and the panel shows no player.
previewRoutes.get("/:token", async (c) => {
  const id = await songOfCoverToken(c.req.param("token"), c.env.STATE_SECRET);
  let bytes: ArrayBuffer | null = null;
  if (id !== null) {
    try {
      bytes = await previewAudio(id, c.env);
    } catch (error) {
      if (!(error instanceof DeezerUnavailableError)) throw error;
      console.warn(`preview: ${error.message}`);
      c.header("Retry-After", String(PREVIEW_RETRY_AFTER_SECONDS));
      c.header("Cache-Control", "no-store");
      return c.json({ error: "the extract is unavailable, try again" }, 503);
    }
  }
  if (bytes === null) {
    c.header("Cache-Control", `public, max-age=${NO_PREVIEW_MAX_AGE_SECONDS}`);
    return c.json({ error: "no extract" }, 404);
  }
  return audioResponse(bytes, c.req.header("Range") ?? null);
});

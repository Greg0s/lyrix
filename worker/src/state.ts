import { isDayKey } from "../../src/game/daily";
import { isHintId } from "../../src/game/hints";
import type { HintId } from "../../src/game/types";

export interface StatePayload {
  songId: string;
  foundKeys: string[];
  /**
   * The UTC day the round is the song of (YYYY-MM-DD): a song can come back on
   * another day, and the archives keep one round per day. Every state carries
   * it: one sealed before the archives (and before FIRST_SONG_DAY) is refused.
   */
  day: string;
  /**
   * Guesses the Worker answered on this round, found or not: what unlocks a
   * hint (src/game/hints.ts). Missing from a state sealed before hints.
   */
  tried?: number;
  /** The hints revealed, in the order chosen. Missing when none is, or from a state sealed before hints. */
  hints?: HintId[];
}

/** Where a round stands with its hints: what the guess count allows, and what was taken. */
export interface HintProgress {
  tried: number;
  used: readonly HintId[];
}

/**
 * A state's hint progress. One sealed before hints counted no guesses: its
 * found words are the guesses it is sure of (a missed one left no trace).
 */
export function hintProgressOf(payload: StatePayload): HintProgress {
  return { tried: payload.tried ?? payload.foundKeys.length, used: payload.hints ?? [] };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

// Both keys are derived from STATE_SECRET, which never changes within an
// isolate - so each is derived once and the CryptoKey reused, rather than
// re-derived twice per guess (once to open the state the client echoed back,
// once to seal the new one). Keyed by secret so a test or a rotated binding
// gets its own key; a failed import is not kept, so a misconfigured secret
// still reports itself on every request.
function memoizedKey(derive: (secret: string) => Promise<CryptoKey>): (secret: string) => Promise<CryptoKey> {
  const cache = new Map<string, Promise<CryptoKey>>();
  return (secret) => {
    const cached = cache.get(secret);
    if (cached) return cached;
    const key = derive(secret).catch((error: unknown) => {
      cache.delete(secret);
      throw error;
    });
    cache.set(secret, key);
    return key;
  };
}

const HKDF_INFO = encoder.encode("lyrix round state v2");

const aesKey = memoizedKey(async (secret) => {
  // HKDF takes an empty key without complaint (HMAC used to refuse one): an
  // unset secret would seal every round with a key anyone can derive.
  if (secret.length === 0) throw new Error("STATE_SECRET is empty, so round state can't be sealed");
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: HKDF_INFO },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
});


function isStatePayload(value: unknown): value is StatePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.songId === "string" &&
    Array.isArray(candidate.foundKeys) &&
    candidate.foundKeys.every((key) => typeof key === "string") &&
    isDayKey(candidate.day) &&
    (candidate.tried === undefined ||
      (typeof candidate.tried === "number" && Number.isInteger(candidate.tried) && candidate.tried >= 0)) &&
    (candidate.hints === undefined ||
      (Array.isArray(candidate.hints) &&
        candidate.hints.every(isHintId) &&
        new Set(candidate.hints).size === candidate.hints.length))
  );
}

function parsePayload(bytes: ArrayBuffer | Uint8Array): StatePayload | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(bytes));
    return isStatePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const IV_BYTES = 12;

// Opaque round state handed to the client and echoed back on every guess.
// This lets the Worker stay stateless (no KV/D1) while making it impossible
// for a client to forge "already found" words: AES-GCM authenticates what it
// encrypts, so a tampered token fails to open and the server never trusts
// client-supplied progress it didn't seal itself. It is encrypted, not just
// signed, because the payload names the song: a signed-only state decoded to
// the day's title in one line of DevTools (#40).
export async function sealState(payload: StatePayload, secret: string): Promise<string> {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(payload)));
  const token = new Uint8Array(IV_BYTES + sealed.byteLength);
  token.set(iv);
  token.set(new Uint8Array(sealed), IV_BYTES);
  return toBase64Url(token);
}

export async function openState(token: string, secret: string): Promise<StatePayload | null> {
  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length <= IV_BYTES) return null;
  const key = await aesKey(secret);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES) },
      key,
      bytes.subarray(IV_BYTES)
    );
    return parsePayload(plain);
  } catch {
    return null;
  }
}

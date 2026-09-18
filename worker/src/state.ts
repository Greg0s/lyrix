export interface StatePayload {
  songId: string;
  foundKeys: string[];
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

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// Importing the key is the only non-trivial work signing does, and the secret
// never changes within an isolate - so it is imported once and the CryptoKey
// reused, rather than re-derived twice per guess (once to sign the new state,
// once to verify the one the client echoed back). Keyed by secret so a test or
// a rotated binding gets its own key; a failed import is not kept, so a
// misconfigured secret still reports itself on every request.
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const key = crypto.subtle
    .importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
    .catch((error: unknown) => {
      keyCache.delete(secret);
      throw error;
    });
  keyCache.set(secret, key);
  return key;
}

function isStatePayload(value: unknown): value is StatePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.songId === "string" &&
    Array.isArray(candidate.foundKeys) &&
    candidate.foundKeys.every((key) => typeof key === "string")
  );
}

// Opaque, HMAC-signed round state handed to the client and echoed back on
// every guess. This lets the Worker stay stateless (no KV/D1) while making
// it impossible for a client to forge "already found" words: tampering
// invalidates the signature, so the server never trusts client-supplied
// progress it didn't sign itself.
export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyState(token: string, secret: string): Promise<StatePayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(body));
  if (!valid) return null;

  try {
    const parsed: unknown = JSON.parse(decoder.decode(fromBase64Url(body)));
    return isStatePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

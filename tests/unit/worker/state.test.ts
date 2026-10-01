import { describe, expect, it, vi } from "vitest";
import { sealState, openState } from "../../../worker/src/state";
import { fromBase64Url, toBase64Url } from "./titleLeak";

describe("sealState / openState", () => {
  it("round-trips a payload", async () => {
    const token = await sealState({ songId: "abc", foundKeys: ["le", "ete"] }, "secret");
    expect(await openState(token, "secret")).toEqual({ songId: "abc", foundKeys: ["le", "ete"] });
  });

  it("round-trips the day a round is the song of", async () => {
    const token = await sealState({ songId: "abc", foundKeys: [], day: "2026-09-26" }, "secret");
    expect((await openState(token, "secret"))?.day).toBe("2026-09-26");
  });

  it("refuses a payload whose day isn't a calendar day", async () => {
    const token = await sealState({ songId: "abc", foundKeys: [], day: "2026-02-30" }, "secret");
    expect(await openState(token, "secret")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await sealState({ songId: "abc", foundKeys: [] }, "secret-a");
    expect(await openState(token, "secret-b")).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await sealState({ songId: "abc", foundKeys: [] }, "secret");
    // The first character, not the last: that one can hold padding bits base64 decoding drops.
    const tampered = (token[0] === "a" ? "b" : "a") + token.slice(1);
    expect(await openState(tampered, "secret")).toBeNull();
  });

  it("rejects garbage input", async () => {
    expect(await openState("not-a-token", "secret")).toBeNull();
    expect(await openState("", "secret")).toBeNull();
    expect(await openState("a.b.c", "secret")).toBeNull();
    expect(await openState("a.b", "secret")).toBeNull();
    expect(await openState("!!!", "secret")).toBeNull();
  });

  // Regression test for #40: the state used to be signed but not encrypted,
  // so its base64url payload named the day's song to anyone who decoded it.
  it("keeps its payload unreadable, however the token is decoded", async () => {
    const token = await sealState({ songId: "le-refuge-de-novembre", foundKeys: ["jardin"] }, "secret");
    const decoded = token
      .split(".")
      .map(fromBase64Url)
      .join("");
    for (const secret of ["refuge", "novembre", "jardin"]) {
      expect(decoded).not.toContain(secret);
      expect(token).not.toContain(secret);
    }
  });

  it("seals the same payload differently every time", async () => {
    const payload = { songId: "abc", foundKeys: [] };
    expect(await sealState(payload, "secret")).not.toBe(await sealState(payload, "secret"));
  });
});

/** A token as the Worker signed them before #40: `<base64url JSON>.<base64url HMAC-SHA256>`. */
async function legacyToken(payload: unknown, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const body = toBase64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${toBase64Url(signature)}`;
}

describe("a state signed before #40", () => {
  // A round started before the deploy must not restart mid-day.
  it("still opens, with the secret it was signed with", async () => {
    const token = await legacyToken({ songId: "abc", foundKeys: ["le"] }, "secret");
    expect(await openState(token, "secret")).toEqual({ songId: "abc", foundKeys: ["le"] });
    expect(await openState(token, "other-secret")).toBeNull();
  });

  it("is still refused once tampered with", async () => {
    const token = await legacyToken({ songId: "abc", foundKeys: [] }, "secret");
    const [, signature] = token.split(".");
    const forged = `${toBase64Url(JSON.stringify({ songId: "abc", foundKeys: ["le"] }))}.${signature}`;
    expect(await openState(forged, "secret")).toBeNull();
  });
});

describe("the state key", () => {
  // Signing used to import the HMAC key from scratch on every call - twice per
  // guess, once to verify the state the client echoed back and once to sign
  // the new one - although the secret never changes within an isolate.
  it("is derived once per secret, however many tokens it seals", async () => {
    const importKey = vi.spyOn(crypto.subtle, "importKey");

    const token = await sealState({ songId: "abc", foundKeys: [] }, "reused-secret");
    await openState(token, "reused-secret");
    await sealState({ songId: "abc", foundKeys: ["le"] }, "reused-secret");

    expect(importKey).toHaveBeenCalledTimes(1);
    importKey.mockRestore();
  });

  it("is never shared between two secrets", async () => {
    const token = await sealState({ songId: "abc", foundKeys: [] }, "secret-one");
    expect(await openState(token, "secret-two")).toBeNull();
    expect(await openState(token, "secret-one")).toEqual({ songId: "abc", foundKeys: [] });
  });

  it("keeps reporting a secret it cannot import, instead of caching the failure", async () => {
    await expect(sealState({ songId: "abc", foundKeys: [] }, "")).rejects.toThrow();
    await expect(sealState({ songId: "abc", foundKeys: [] }, "")).rejects.toThrow();
  });
});

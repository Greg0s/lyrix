import { describe, expect, it, vi } from "vitest";
import { signState, verifyState } from "../../../worker/src/state";

describe("signState / verifyState", () => {
  it("round-trips a payload", async () => {
    const token = await signState({ songId: "abc", foundKeys: ["le", "ete"] }, "secret");
    expect(await verifyState(token, "secret")).toEqual({ songId: "abc", foundKeys: ["le", "ete"] });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signState({ songId: "abc", foundKeys: [] }, "secret-a");
    expect(await verifyState(token, "secret-b")).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signState({ songId: "abc", foundKeys: [] }, "secret");
    const lastChar = token.at(-1);
    const tampered = token.slice(0, -1) + (lastChar === "a" ? "b" : "a");
    expect(await verifyState(tampered, "secret")).toBeNull();
  });

  it("rejects garbage input", async () => {
    expect(await verifyState("not-a-token", "secret")).toBeNull();
    expect(await verifyState("", "secret")).toBeNull();
    expect(await verifyState("a.b.c", "secret")).toBeNull();
  });
});

describe("the signing key", () => {
  // Signing used to import the HMAC key from scratch on every call - twice per
  // guess, once to verify the state the client echoed back and once to sign
  // the new one - although the secret never changes within an isolate.
  it("is imported once per secret, however many tokens it signs", async () => {
    const importKey = vi.spyOn(crypto.subtle, "importKey");

    const token = await signState({ songId: "abc", foundKeys: [] }, "reused-secret");
    await verifyState(token, "reused-secret");
    await signState({ songId: "abc", foundKeys: ["le"] }, "reused-secret");

    expect(importKey).toHaveBeenCalledTimes(1);
    importKey.mockRestore();
  });

  it("is never shared between two secrets", async () => {
    const token = await signState({ songId: "abc", foundKeys: [] }, "secret-one");
    expect(await verifyState(token, "secret-two")).toBeNull();
    expect(await verifyState(token, "secret-one")).toEqual({ songId: "abc", foundKeys: [] });
  });

  it("keeps reporting a secret it cannot import, instead of caching the failure", async () => {
    await expect(signState({ songId: "abc", foundKeys: [] }, "")).rejects.toThrow();
    await expect(signState({ songId: "abc", foundKeys: [] }, "")).rejects.toThrow();
  });
});

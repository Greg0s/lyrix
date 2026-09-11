import { describe, expect, it } from "vitest";
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

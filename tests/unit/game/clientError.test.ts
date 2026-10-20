import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LINES,
  parseClientErrorReport,
  scrubAddresses,
  trimStack,
} from "../../../src/game/clientError";

const report = {
  kind: "error",
  message: "TypeError: x is undefined",
  source: "/assets/index-abc.js",
  line: 12,
  column: 340,
  stack: "TypeError: x is undefined\n    at f (/assets/index-abc.js:12:340)",
  page: "today",
};

describe("a client error report", () => {
  it("keeps what tells where the game broke, the stack's lines trimmed", () => {
    expect(parseClientErrorReport(report)).toEqual({ ...report, stack: "TypeError: x is undefined\nat f (/assets/index-abc.js:12:340)" });
  });

  it("refuses anything that isn't a report", () => {
    for (const body of [null, "boom", {}, { ...report, kind: "warning" }, { ...report, message: "" }, { ...report, message: 3 }]) {
      expect(parseClientErrorReport(body)).toBeNull();
    }
  });

  it("keeps an address's path alone, and never an invite link's code", () => {
    expect(scrubAddresses("failed https://lyrix-eyg.pages.dev/assets/a.js?v=1#x at line")).toBe("failed /assets/a.js at line");
    expect(scrubAddresses("wss://api.example.com/api/rooms/ABC234/socket?token=secret")).toBe("/api/rooms/ABC234/socket");
    expect(scrubAddresses("on https://lyrix.test/salon/ABC234 and /salon/XYZ789")).toBe("on /salon/… and /salon/…");
    expect(scrubAddresses("see https://example.com")).toBe("see /");
    // A stack's line and column stay, after a query string too.
    expect(scrubAddresses("at f (https://lyrix.test/assets/a.js?v=2:12:340)")).toBe("at f (/assets/a.js:12:340)");
  });

  it("bounds every field, whatever was sent", () => {
    const parsed = parseClientErrorReport({
      ...report,
      message: "x".repeat(1000),
      line: -1,
      column: 1.5,
      page: "../../etc",
      stack: Array.from({ length: 50 }, (_, i) => `at f${i} (https://lyrix.test/assets/a.js:${i}:1)`).join("\n"),
    });
    expect(parsed?.message).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(parsed?.line).toBe(0);
    expect(parsed?.column).toBe(0);
    expect(parsed?.page).toBe("");
    expect(parsed?.stack.split("\n")).toHaveLength(MAX_STACK_LINES);
    expect(parsed?.stack).not.toContain("https://");
  });

  it("reads a stack written with Windows line endings like any other", () => {
    expect(trimStack("Error: a\r\n  at f (x.js:1:1)\r\n")).toBe("Error: a\nat f (x.js:1:1)");
  });
});

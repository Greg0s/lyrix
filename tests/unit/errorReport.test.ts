// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientErrorReport } from "../../src/game/clientError";
import { MAX_REPORTS_PER_LOAD, reportFor, resetErrorReports, sendReport, startErrorReports } from "../../src/errorReport";

const LOCATION = { origin: "https://lyrix.test", pathname: "/archives" };

let sent: { url: string; body: ClientErrorReport }[];

beforeEach(() => {
  resetErrorReports();
  sent = [];
  vi.stubGlobal("navigator", {
    ...navigator,
    sendBeacon: (url: string, body: string) => {
      sent.push({ url, body: JSON.parse(body) as ClientErrorReport });
      return true;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an error the game met", () => {
  it("is reported with where it was thrown, the screen it was on, and its stack", () => {
    const error = new TypeError("x is undefined");
    error.stack = "TypeError: x is undefined\n    at f (https://lyrix.test/assets/index-abc.js?v=2:12:340)";
    const report = reportFor(
      "error",
      { message: "TypeError: x is undefined", source: "https://lyrix.test/assets/index-abc.js", line: 12, column: 340, error },
      LOCATION
    );
    expect(report).toEqual({
      kind: "error",
      message: "TypeError: x is undefined",
      source: "/assets/index-abc.js",
      line: 12,
      column: 340,
      stack: "TypeError: x is undefined\nat f (/assets/index-abc.js:12:340)",
      page: "archives",
    });
  });

  it("isn't reported when it comes from another origin's script, or hides what it was", () => {
    expect(reportFor("error", { message: "boom", source: "chrome-extension://abc/content.js" }, LOCATION)).toBeNull();
    expect(reportFor("error", { message: "boom", source: "https://ads.example.com/x.js" }, LOCATION)).toBeNull();
    expect(reportFor("error", { message: "Script error." }, LOCATION)).toBeNull();
    expect(reportFor("error", { message: "boom" }, LOCATION)).not.toBeNull();
  });

  it("is sent once, and no more than a few per page load", () => {
    const report = (message: string) => reportFor("error", { message }, LOCATION) as ClientErrorReport;
    expect(sendReport(report("once"))).toBe(true);
    expect(sendReport(report("once"))).toBe(false);
    for (let i = 0; i < 10; i += 1) sendReport(report(`error ${i}`));
    expect(sent).toHaveLength(MAX_REPORTS_PER_LOAD);
    expect(new URL(sent[0].url).pathname).toBe("/api/client-error");
  });
});

describe("the page's uncaught errors", () => {
  it("are reported, a promise rejected with no handler included, an aborted request not", async () => {
    startErrorReports();
    window.dispatchEvent(new ErrorEvent("error", { message: "Uncaught Error: thrown", error: new Error("thrown") }));
    const rejection = (reason: unknown) => {
      const event = new Event("unhandledrejection") as Event & { reason: unknown };
      event.reason = reason;
      window.dispatchEvent(event);
    };
    rejection(new RangeError("too far"));
    rejection(new DOMException("aborted", "AbortError"));
    // An image that failed to load: a plain Event, no bug of the code's.
    window.dispatchEvent(new Event("error"));

    expect(sent.map(({ body }) => [body.kind, body.message])).toEqual([
      ["error", "Uncaught Error: thrown"],
      ["rejection", "RangeError: too far"],
    ]);
  });
});

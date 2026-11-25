import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countClick, EVENTS, SIGNALS, signal, track } from "../../src/analytics";
import { vi } from "vitest";

/** The clicks Umami counts (src/analytics.ts): attributes only, read by Umami's own script. */

const componentsDir = fileURLToPath(new URL("../../src/components/", import.meta.url));

describe("tracked clicks", () => {
  it("are the attributes Umami reads: the event's name, then one per piece of data", () => {
    expect(track(EVENTS.revealHint, { hint: "decade", from: "card" })).toEqual({
      "data-umami-event": "hint-reveal",
      "data-umami-event-hint": "decade",
      "data-umami-event-from": "card",
    });
    expect(track(EVENTS.openHelp)).toEqual({ "data-umami-event": "help-open" });
  });

  it("have distinct, kebab-case names", () => {
    const names = Object.values(EVENTS);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("are each put on a control somewhere, none left unused", () => {
    const source = readdirSync(componentsDir)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(componentsDir + file, "utf8"))
      .join("\n");
    for (const key of Object.keys(EVENTS)) expect(source, key).toMatch(new RegExp(`EVENTS\\.${key}\\b`));
  });
});

describe("a link's click, counted from the click itself", () => {
  it("reaches Umami's tracker with the event's name and data", () => {
    const umami = { track: vi.fn() };
    countClick(EVENTS.openArchives, { from: "tabbar" }, { umami } as unknown as Window);
    expect(umami.track).toHaveBeenCalledWith("archives-open", { from: "tabbar" });
  });

  it("does nothing without Umami, and never throws", () => {
    expect(() => countClick(EVENTS.openHelp, {}, {} as Window)).not.toThrow();
  });

  it("is how every link counts: no component spreads track() onto an <a> or a RouteLink", () => {
    for (const file of readdirSync(componentsDir).filter((name) => name.endsWith(".tsx"))) {
      const source = readFileSync(componentsDir + file, "utf8");
      // Each JSX element opening an <a> or a RouteLink, up to its first `>` not in braces.
      for (const match of source.matchAll(/<(a|RouteLink)\b(?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*>/g)) {
        expect(match[0], file).not.toMatch(/track\(/);
      }
    }
  });
});

describe("signals, what Umami counts that is no click", () => {
  it("reach Umami's tracker when its script is on the page", () => {
    const umami = { track: vi.fn() };
    signal(SIGNALS.installOfferShown, { platform: "ios" }, { umami } as unknown as Window);
    expect(umami.track).toHaveBeenCalledWith("install-offer-show", { platform: "ios" });
  });

  it("do nothing without it, and never throw", () => {
    expect(() => signal(SIGNALS.appInstalled, {}, {} as Window)).not.toThrow();
    const umami = {
      track: () => {
        throw new Error("blocked");
      },
    };
    expect(() => signal(SIGNALS.appInstalled, {}, { umami } as unknown as Window)).not.toThrow();
  });

  it("have distinct, kebab-case names, none a click's", () => {
    const names = Object.values(SIGNALS);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(Object.values(EVENTS)).not.toContain(name);
    }
  });
});

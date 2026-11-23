import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureInstallPrompt,
  installMode,
  isIosSafari,
  promptInstall,
  resetInstall,
} from "../../../src/install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_SITE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

interface FakeWindow {
  win: Window;
  fire(type: string, event?: Event): void;
}

/** A window with only what install.ts reads: events, display-mode, the navigator. */
function fakeWindow({ ua = ANDROID_CHROME, touch = 5, standalone = false } = {}): FakeWindow {
  const handlers = new Map<string, ((event: Event) => void)[]>();
  const win = {
    addEventListener(type: string, handler: (event: Event) => void) {
      handlers.set(type, [...(handlers.get(type) ?? []), handler]);
    },
    matchMedia: (query: string) => ({ matches: standalone && query.includes("standalone") }),
    navigator: { userAgent: ua, maxTouchPoints: touch },
  } as unknown as Window;
  return {
    win,
    fire(type, event = new Event(type)) {
      for (const handler of handlers.get(type) ?? []) handler(event);
    },
  };
}

function promptEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
}

beforeEach(() => resetInstall());

describe("Safari on an iPhone or iPad", () => {
  it("is told apart from other iOS browsers and apps' own", () => {
    expect(isIosSafari({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: IPAD_DESKTOP_SITE, maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: IPAD_DESKTOP_SITE, maxTouchPoints: 0 })).toBe(false); // a Mac
    expect(isIosSafari({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: IPHONE_INSTAGRAM, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 })).toBe(false);
  });
});

describe("how Lyrix can be installed", () => {
  it("offers nothing where the browser has no way to", () => {
    expect(installMode(fakeWindow().win)).toBeNull();
  });

  it("gives Safari on iOS its own steps", () => {
    expect(installMode(fakeWindow({ ua: IPHONE_SAFARI }).win)).toBe("ios");
  });

  it("offers nothing once opened as the app", () => {
    expect(installMode(fakeWindow({ ua: IPHONE_SAFARI, standalone: true }).win)).toBe("installed");
  });

  it("keeps the browser's prompt for the player's click, and opens it once", async () => {
    const { win, fire } = fakeWindow();
    captureInstallPrompt(win);
    const event = promptEvent("accepted");
    fire("beforeinstallprompt", event);
    expect(event.defaultPrevented).toBe(true);
    expect(installMode(win)).toBe("prompt");

    await expect(promptInstall()).resolves.toBe("accepted");
    expect(event.prompt).toHaveBeenCalledTimes(1);
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("drops the offer as soon as the app is installed", () => {
    const { win, fire } = fakeWindow();
    captureInstallPrompt(win);
    fire("beforeinstallprompt", promptEvent("dismissed"));
    fire("appinstalled");
    expect(installMode(win)).toBe("installed");
  });
});

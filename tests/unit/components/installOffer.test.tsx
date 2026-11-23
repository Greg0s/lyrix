// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArchiveEntry } from "../../../src/game/archive";

/**
 * The offer to install Lyrix in the victory panel (proposition A), and the
 * rules' page's "Installer l'appli": who sees them, and what each answer does.
 */

const archive = vi.hoisted(() => ({ entries: {} as Record<string, ArchiveEntry> }));
vi.mock("../../../src/roundStorage", () => ({ loadArchive: () => archive.entries }));

const { InstallOffer } = await import("../../../src/components/InstallOffer");
const { InstallAppAction } = await import("../../../src/components/InstallAppAction");
const { captureInstallPrompt, resetInstall } = await import("../../../src/install");
const { INSTALL_STORAGE_KEY, dismissInstallOffer } = await import("../../../src/installStorage");

const TODAY = "2026-11-23";
const won = (): ArchiveEntry => ({ title: [], percent: 50, victory: true, tries: 20 });

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

function offerPrompt(outcome: "accepted" | "dismissed") {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function useUserAgent(ua: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);
}

let umamiTrack: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${TODAY}T10:00:00Z`) });
  resetInstall();
  localStorage.clear();
  archive.entries = { "2026-11-20": won() };
  window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
  umamiTrack = vi.fn();
  (window as Window & { umami?: unknown }).umami = { track: umamiTrack };
  captureInstallPrompt(window);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (window as Window & { umami?: unknown }).umami;
});

const offer = () => screen.queryByRole("region", { name: "Lyrix sur ton écran d'accueil" });

describe("the victory panel's offer to install Lyrix", () => {
  it("waits for a browser that can install it", () => {
    render(<InstallOffer wonDay={TODAY} />);
    expect(offer()).toBeNull();
    offerPrompt("accepted");
    expect(offer()).not.toBeNull();
    expect(screen.getByText(/Tu as trouvé 2 chansons/)).toBeTruthy();
    expect(umamiTrack).toHaveBeenCalledWith("install-offer-show", { platform: "prompt" });
  });

  it("is never made on a first song found", () => {
    archive.entries = {};
    offerPrompt("accepted");
    render(<InstallOffer wonDay={TODAY} />);
    expect(offer()).toBeNull();
  });

  it("is never made in the installed app", () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("standalone"),
      media: query,
    })) as unknown as typeof window.matchMedia;
    offerPrompt("accepted");
    render(<InstallOffer wonDay={TODAY} />);
    expect(offer()).toBeNull();
  });

  it("is never made again soon after a no", () => {
    dismissInstallOffer();
    offerPrompt("accepted");
    render(<InstallOffer wonDay={TODAY} />);
    expect(offer()).toBeNull();
  });

  it("opens the browser's own dialog, and goes once installed", async () => {
    const event = offerPrompt("accepted");
    render(<InstallOffer wonDay={TODAY} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Installer Lyrix" }));
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(umamiTrack).toHaveBeenCalledWith("install-prompt-accept", undefined);
    expect(offer()).toBeNull();
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).toBeNull();
  });

  it("takes a no in the browser's dialog as \"Plus tard\"", async () => {
    offerPrompt("dismissed");
    render(<InstallOffer wonDay={TODAY} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Installer Lyrix" }));
    });
    expect(offer()).toBeNull();
    expect(localStorage.getItem(INSTALL_STORAGE_KEY)).not.toBeNull();
  });

  it("goes for two weeks on \"Plus tard\"", () => {
    offerPrompt("accepted");
    render(<InstallOffer wonDay={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: "Plus tard" }));
    expect(offer()).toBeNull();
    expect(JSON.parse(localStorage.getItem(INSTALL_STORAGE_KEY) ?? "null")).toEqual({ count: 1, lastDay: TODAY });
  });

  it("shows Safari on iOS its two taps, and goes for good on \"C'est fait\"", () => {
    useUserAgent(IPHONE_SAFARI);
    render(<InstallOffer wonDay={TODAY} />);
    expect(screen.getByText(/Sur l'écran d'accueil/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Installer Lyrix" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "C'est fait" }));
    expect(offer()).toBeNull();
    cleanup();
    vi.setSystemTime(new Date("2027-06-01T10:00:00Z"));
    render(<InstallOffer wonDay="2027-06-01" />);
    expect(offer()).toBeNull();
  });
});

describe("the rules' page's \"Installer l'appli\"", () => {
  it("shows only where the browser can install Lyrix, engaged or not", () => {
    archive.entries = {};
    dismissInstallOffer();
    render(<InstallAppAction />);
    expect(screen.queryByRole("button", { name: "Installer l'appli" })).toBeNull();
    const event = offerPrompt("dismissed");
    fireEvent.click(screen.getByRole("button", { name: "Installer l'appli" }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("unfolds Safari on iOS's two taps", () => {
    useUserAgent(IPHONE_SAFARI);
    render(<InstallAppAction />);
    const button = screen.getByRole("button", { name: "Installer l'appli" });
    expect(screen.queryByText(/Sur l'écran d'accueil/)).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Sur l'écran d'accueil/)).toBeTruthy();
  });
});

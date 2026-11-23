import { useSyncExternalStore } from "react";

/**
 * How Lyrix can be installed in this browser (#79's manifest and service
 * worker make it installable), so an offer to (InstallOffer.tsx) shows only
 * where it can be taken up:
 *
 * - "prompt": Chrome, Edge, Samsung Internet... fired `beforeinstallprompt`,
 *   kept here (`captureInstallPrompt`) to open the browser's own dialog later,
 *   from the player's own click;
 * - "ios": Safari on an iPhone or iPad, which has no such event: the offer
 *   says where its "Sur l'écran d'accueil" is;
 * - "installed": already opened from the home screen, nothing to offer;
 * - null: nothing this browser offers (Firefox, Safari on a Mac, an app's
 *   own browser...), so nothing is said.
 */
export type InstallMode = "prompt" | "ios" | "installed" | null;

/** The event Chromium fires once a page may be installed; not in TypeScript's DOM library. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Keeps the browser's install prompt for later instead of its own mini-infobar
 * (main.tsx, before React renders: the event may fire early). Also hears the
 * app being installed, whichever way, so the offer goes at once.
 */
export function captureInstallPrompt(win: Window = window): void {
  win.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  win.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

/** Whether this page was opened as the installed app. */
export function isStandalone(win: Window = window): boolean {
  if (win.matchMedia?.("(display-mode: standalone)").matches) return true;
  // Safari on iOS says so on navigator alone.
  return (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Safari itself on an iPhone or iPad (an iPad asks for desktop sites and says
 * "Macintosh", but has a touch screen). Other iOS browsers and apps' own
 * browsers (Instagram, Facebook...) are left out: their menus differ, or have no
 * "Sur l'écran d'accueil" at all.
 */
export function isIosSafari(nav: Pick<Navigator, "userAgent" | "maxTouchPoints">): boolean {
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  if (!ios) return false;
  if (!/Safari\//.test(ua) || !/Version\//.test(ua)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok/.test(ua);
}

export function installMode(win: Window = window): InstallMode {
  if (installedNow || isStandalone(win)) return "installed";
  if (deferred) return "prompt";
  return isIosSafari(win.navigator) ? "ios" : null;
}

/**
 * Opens the browser's install dialog: from a click only (browsers refuse it
 * otherwise), and once per event. "unavailable" when there is none to open.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  try {
    await event.prompt();
    return (await event.userChoice).outcome;
  } catch {
    return "unavailable";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverMode = (): InstallMode => null;

/** The install mode, kept current as the browser's events come (a component re-renders only when it changes). */
export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, () => installMode(), serverMode);
}

/** Forgets what was heard: tests only. */
export function resetInstall(): void {
  deferred = null;
  installedNow = false;
  listeners.clear();
}

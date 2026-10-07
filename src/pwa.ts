import { SERVICE_WORKER_PATH } from "./serviceWorker/routes";

/**
 * Said wherever the game would otherwise just fail with no network
 * (GameScreen): in place of a round that couldn't load, and in the dock
 * while one is shown (an installed Lyrix opens offline, on today's round
 * restored from storage).
 */
export const OFFLINE_MESSAGE = "Hors ligne — reconnecte-toi pour jouer.";

/**
 * Registers the service worker (src/serviceWorker/sw.ts, #79), which keeps
 * the app shell so an installed Lyrix opens without the network, once the
 * page has loaded: its first install downloads the shell again, and the
 * game's own first requests come first.
 *
 * Production builds only (main.tsx): the dev server serves modules no worker
 * could keep, and a worker left from one run would answer the next.
 */
export function registerServiceWorker(win: Window = window): void {
  // Not offered over plain http, nor by some private modes: the game plays the same without it.
  if (!("serviceWorker" in win.navigator)) return;
  const container = win.navigator.serviceWorker;
  const register = () => {
    container.register(SERVICE_WORKER_PATH).catch((error: unknown) => {
      console.warn("Lyrix: the service worker could not be registered", error);
    });
  };
  if (win.document.readyState === "complete") register();
  else win.addEventListener("load", register, { once: true });
}

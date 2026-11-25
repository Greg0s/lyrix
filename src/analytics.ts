/**
 * The clicks Umami counts (scripts/lib/umami.ts), as `data-umami-event`
 * attributes: Umami's own script reads them on a click, so nothing here
 * runs or sends anything, and without Umami (dev, e2e, opted out) they are
 * inert. An event names a control, never anything a player typed or found:
 * no word, room code, pseudo or song (CLAUDE.md, "Statistics are counts,
 * never people"). Names are what Greg sees in Umami: never rename one that
 * has shipped, or its history splits in two.
 */
export const EVENTS = {
  openMultiplayer: "multiplayer-open",
  dismissPromo: "multiplayer-promo-dismiss",
  createRoom: "room-create",
  joinRoom: "room-join",
  leaveRoom: "room-leave",
  copyRoomCode: "room-code-copy",
  shareInvite: "room-invite-share",
  openArchives: "archives-open",
  openHelp: "help-open",
  revealHint: "hint-reveal",
  revealGroupAnswer: "group-answer-reveal",
  showAllLyrics: "lyrics-show-all",
  playNextDay: "next-day-play",
  toggleTheme: "theme-toggle",
  startTour: "tour-start",
  skipTour: "tour-skip",
  installApp: "install-app",
  dismissInstall: "install-dismiss",
  installedAlready: "install-done",
  playPreview: "preview-play",
} as const;

export type TrackedEvent = (typeof EVENTS)[keyof typeof EVENTS];

/** Event data, as Umami reads it: one `data-umami-event-<key>` attribute per entry. Fixed labels only. */
export type EventData = Record<string, string>;

/**
 * The attributes that make Umami count a click on an element, spread onto it.
 * Never onto a link (`<a>`, RouteLink): Umami's script cancels a click on a
 * link carrying them and opens its address itself once the event is sent, a
 * whole page load where the game changes screen in place, so every tap on
 * the tab bar's Archives and Plus reloaded the game wherever Umami ran (the
 * installed app among them). A link counts its click with `countClick`.
 */
export function track(event: TrackedEvent, data: EventData = {}): Record<string, string> {
  const attrs: Record<string, string> = { "data-umami-event": event };
  for (const [key, value] of Object.entries(data)) attrs[`data-umami-event-${key}`] = value;
  return attrs;
}

/**
 * What Umami counts that is no click: the install offer shown, and what the
 * browser's own install dialog answered. Same rules as the clicks: fixed
 * names and labels only, never renamed once shipped.
 */
export const SIGNALS = {
  installOfferShown: "install-offer-show",
  installPromptAccepted: "install-prompt-accept",
  installPromptDismissed: "install-prompt-dismiss",
  appInstalled: "app-installed",
} as const;

export type Signal = (typeof SIGNALS)[keyof typeof SIGNALS];

interface UmamiTracker {
  track(event: string, data?: EventData): unknown;
}

/** Hands an event to Umami's tracker, if its script is on the page; never throws. */
function send(name: string, data: EventData | undefined, win: Window): void {
  const umami = (win as Window & { umami?: Partial<UmamiTracker> }).umami;
  if (typeof umami?.track !== "function") return;
  try {
    umami.track(name, data);
  } catch {
    // Counting is never worth an error.
  }
}

/**
 * Counts a click on a link (RouteLink's `tracked`), where `track()`'s
 * attributes would have Umami reload the page: the same event and data, sent
 * from the click itself. Same conditions as a signal.
 */
export function countClick(event: TrackedEvent, data: EventData = {}, win: Window = window): void {
  send(event, data, win);
}

/**
 * Has Umami count a signal, if its script is on the page (production only)
 * and allowed to (it heeds Do Not Track and the legal page's opt-out itself):
 * otherwise nothing happens.
 */
export function signal(name: Signal, data?: EventData, win: Window = window): void {
  send(name, data, win);
}

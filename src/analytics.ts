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
} as const;

export type TrackedEvent = (typeof EVENTS)[keyof typeof EVENTS];

/** Event data, as Umami reads it: one `data-umami-event-<key>` attribute per entry. Fixed labels only. */
export type EventData = Record<string, string>;

/** The attributes that make Umami count a click on an element, spread onto it. */
export function track(event: TrackedEvent, data: EventData = {}): Record<string, string> {
  const attrs: Record<string, string> = { "data-umami-event": event };
  for (const [key, value] of Object.entries(data)) attrs[`data-umami-event-${key}`] = value;
  return attrs;
}

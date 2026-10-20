/**
 * An error a player's browser met running the game, as it reports it
 * (src/errorReport.ts, POST /api/client-error, worker/src/clientError.ts):
 * what broke and where in the code, so it can be fixed, and nothing about
 * the player. Addresses keep their path alone, and an invite link's code
 * never leaves: a room code is all it takes to join a room.
 */

export const ERROR_KINDS = ["error", "rejection"] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export interface ClientErrorReport {
  /** An uncaught exception ("error") or a promise nobody caught ("rejection"). */
  kind: ErrorKind;
  message: string;
  /** The script it was thrown from, its path alone ("" when the browser didn't say). */
  source: string;
  line: number;
  column: number;
  /** The first lines of the stack, addresses cut down to their path. */
  stack: string;
  /** The screen it happened on (src/game/visit.ts's pages). */
  page: string;
}

export const MAX_MESSAGE_LENGTH = 200;
export const MAX_STACK_LINES = 8;
export const MAX_STACK_LENGTH = 1500;
const MAX_SOURCE_LENGTH = 200;

/** `text` with every address cut down to its path, an invite link's code dropped. */
export function scrubAddresses(text: string): string {
  return text
    .replace(/\b(?:https?|wss?):\/\/[^\s/)'"]+(\/[^\s?#)'"]*)?(?:[?#][^\s)'":]*)?/g, (_match, path: string | undefined) => path ?? "/")
    .replace(/\/salon\/[A-Za-z0-9]+/g, "/salon/…");
}

function clip(value: unknown, length: number): string {
  return typeof value === "string" ? scrubAddresses(value).slice(0, length) : "";
}

function position(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1e7 ? value : 0;
}

/** The first lines of a stack, scrubbed and bounded. */
export function trimStack(stack: unknown): string {
  if (typeof stack !== "string") return "";
  return scrubAddresses(stack)
    .split(/\r?\n/)
    .slice(0, MAX_STACK_LINES)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n")
    .slice(0, MAX_STACK_LENGTH);
}

/** A report as the Worker keeps it, from whatever a client sent: null for anything that isn't one. */
export function parseClientErrorReport(body: unknown): ClientErrorReport | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;
  if (!(ERROR_KINDS as readonly unknown[]).includes(raw.kind)) return null;
  const message = clip(raw.message, MAX_MESSAGE_LENGTH);
  if (message === "") return null;
  return {
    kind: raw.kind as ErrorKind,
    message,
    source: clip(raw.source, MAX_SOURCE_LENGTH),
    line: position(raw.line),
    column: position(raw.column),
    stack: trimStack(raw.stack),
    page: typeof raw.page === "string" && /^[a-z]{1,20}$/.test(raw.page) ? raw.page : "",
  };
}

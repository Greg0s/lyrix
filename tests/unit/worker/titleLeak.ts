import { normalize } from "../../../src/game/normalize";
import { tokenize } from "../../../src/game/tokenize";
import type { Song } from "../../../src/game/types";

/** A base64url segment decoded to text, one character per byte - how DevTools' atob() would show it. */
export function fromBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  } catch {
    return "";
  }
}

export function toBase64Url(data: string | ArrayBuffer): string {
  const binary =
    typeof data === "string"
      ? String.fromCharCode(...new TextEncoder().encode(data))
      : String.fromCharCode(...new Uint8Array(data));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Everything a client can read out of what it was sent: the text itself, plus
 * every `state` in it decoded the way anyone would try in DevTools - each
 * base64url segment, as text. Before #40, that second part named the song.
 */
function readable(sent: string): string {
  const states = [...sent.matchAll(/"state":"([^"]*)"/g)].map((match) => match[1]);
  const decoded = states
    .flatMap((state) => state.split("."))
    .map(fromBase64Url);
  return normalize([sent, ...decoded].join(" "));
}

/**
 * The words of `song`'s title a client could spot in `sent`, and its catalog
 * id (a slug of the title) if it is there. Words shorter than four letters are
 * left out: "le" or "de" turn up in any JSON field name or random bytes.
 */
export function titleLeaks(sent: string, song: Song): string[] {
  const text = readable(sent);
  const words = tokenize(song.title)
    .filter((token) => token.isWord)
    .map((token) => normalize(token.text))
    .filter((word) => word.length >= 4);
  const present = new Set(tokenize(text).filter((token) => token.isWord).map((token) => token.text));
  return [...words.filter((word) => present.has(word)), ...(text.includes(song.id) ? [song.id] : [])];
}

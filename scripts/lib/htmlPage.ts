/**
 * Rewriting index.html into another page served with the build: the invite
 * page (invitePage.ts) and the rules' page (rulesPage.ts) are both the app
 * itself under head tags of their own.
 */

export const SITE = "https://lyrix.mintymoon.app/";

export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Replaces `pattern`'s single match, or fails loudly: a page silently left
 * with the home page's tags is the bug. A string replacement may use `$1`;
 * text that isn't a pattern (JSON, prose) goes in through a function.
 */
export function replaceOnce(html: string, pattern: RegExp, replacement: string | (() => string), what: string): string {
  const matches = html.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`));
  if (matches?.length !== 1) throw new Error(`expected one ${what} in index.html, found ${matches?.length ?? 0}`);
  return typeof replacement === "string" ? html.replace(pattern, replacement) : html.replace(pattern, replacement);
}

/** Sets a `<meta>`'s content, found by its `name` or `property`. */
export function setMeta(html: string, key: string, content: string): string {
  return replaceOnce(
    html,
    new RegExp(`(<meta\\s+(?:name|property)="${key}"\\s+content=")[^"]*(")`, "s"),
    `$1${escapeAttribute(content)}$2`,
    `<meta ${key}>`
  );
}

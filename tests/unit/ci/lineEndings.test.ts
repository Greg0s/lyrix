import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../../..");

/**
 * Tests read checked-in files (.gitignore, public/_headers, the favicon) and
 * compare them with what scripts write, in LF. On a Windows checkout with Git's
 * core.autocrlf=true those files came out in CRLF, and tests that passed on CI
 * failed there (docs/LEARNINGS.md, 2026-10-19). .gitattributes now checks
 * every text file out with LF; a checkout made before it keeps its CRLF files
 * until they are checked out again, so tests still mustn't depend on it.
 */
describe("the repository's line endings", () => {
  // `git ls-files --eol`: "i/<in the index> w/<in the checkout> attr/<attributes>\t<path>".
  const files = execFileSync("git", ["ls-files", "--eol"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [info, path] = line.split("\t");
      const [, index, attributes] = /^i\/(\S*)\s+w\/\S*\s+attr\/(.*?)\s*$/.exec(info) ?? [];
      return { path, index, attributes };
    });
  const text = files.filter((file) => file.index !== "-text");

  it("checks every text file out with LF, whatever core.autocrlf says", () => {
    expect(text.length).toBeGreaterThan(0);
    expect(text.filter((file) => !/(^|\s)eol=lf(\s|$)/.test(file.attributes)).map((file) => file.path)).toEqual([]);
  });

  it("stores every text file with LF", () => {
    expect(text.filter((file) => file.index !== "lf" && file.index !== "none").map((file) => file.path)).toEqual([]);
  });
});

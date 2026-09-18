import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bulkEntries,
  everySongId,
  findModel,
  modelSearchDirs,
  modelsIn,
  readTableFile,
  tablePath,
} from "../../../scripts/lib/debugMode";
import { catalog, FALLBACK_SONG_ID } from "../../../worker/src/catalog";
import { SIMILARITY_TABLE_VERSION } from "../../../worker/src/similarity";

/** The one table checked into the repository, kept current by tests/unit/ci/debugMode.test.ts. */
const CURRENT_TABLE = "tests/e2e/fixtures/similarity-table.json";

let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "lyrix-local-similarity-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function modelDir(name: string, files: string[]): Promise<string> {
  const path = join(dir, name);
  await mkdir(path, { recursive: true });
  for (const file of files) await writeFile(join(path, file), "");
  return path;
}

describe("finding a model", () => {
  it("prefers the compact form npm run similarity:convert writes", async () => {
    // Both are usable, but the .vecbin loads in a fraction of the time.
    const path = await modelDir("both", ["frwac.bin", "frwac.vecbin"]);
    expect(modelsIn(path)).toEqual([join(path, "frwac.vecbin"), join(path, "frwac.bin")]);
  });

  it("ignores files that aren't models at all", async () => {
    const path = await modelDir("mixed", ["README.md", "frwac.bin", "notes.json"]);
    expect(modelsIn(path)).toEqual([join(path, "frwac.bin")]);
  });

  it("has nothing to offer from a directory nobody created", () => {
    // data/models is gitignored: a fresh clone simply has no such directory.
    expect(modelsIn(join(dir, "absent"))).toEqual([]);
  });

  it("looks in this checkout first, then in the one the repository was cloned into", () => {
    // A worktree never has the model: data/ is gitignored, so it only exists
    // where it was downloaded.
    expect(modelSearchDirs("/repo/.claude/worktrees/feature", "/repo")).toEqual([
      join("/repo/.claude/worktrees/feature", "data/models"),
      join("/repo", "data/models"),
    ]);
  });

  it("looks only once when the checkout is the main one", () => {
    expect(modelSearchDirs("/repo", "/repo")).toEqual([join("/repo", "data/models")]);
    expect(modelSearchDirs("/repo", null)).toEqual([join("/repo", "data/models")]);
  });

  it("takes the first model it finds, and says so with null when there is none", async () => {
    const empty = await modelDir("empty", []);
    const filled = await modelDir("filled", ["frwac.bin"]);

    expect(findModel([empty, filled])).toBe(join(filled, "frwac.bin"));
    expect(findModel([empty])).toBeNull();
  });
});

describe("reading a built table", () => {
  it("hands back the bytes as stored, so the Worker gets the table that was built", async () => {
    const loaded = await readTableFile(CURRENT_TABLE);

    // Not re-serialized from the parsed value: what goes into KV is what the
    // build wrote, and what a rebuild would produce again.
    expect(loaded.json).toBe(await readFile(CURRENT_TABLE, "utf8"));
    expect(loaded.table.version).toBe(SIMILARITY_TABLE_VERSION);
    expect(loaded.table.model).toBe("e2e-fixture");
  });

  // The Worker ignores a table from an older format in silence, which looks
  // exactly like never having loaded one. Better to refuse it here, by name.
  it("refuses a table the Worker would ignore, naming the version it needs", async () => {
    const stale = join(dir, "stale.json");
    await writeFile(stale, JSON.stringify({ version: SIMILARITY_TABLE_VERSION - 1, songId: "x", scores: {}, near: {} }));

    await expect(readTableFile(stale)).rejects.toThrow(new RegExp(`version ${SIMILARITY_TABLE_VERSION}`));
  });

  it("refuses nonsense in place of a table", async () => {
    const broken = join(dir, "broken.json");
    await writeFile(broken, "{not json");

    await expect(readTableFile(broken)).rejects.toThrow(/similarity table/);
  });

  it("says where it looked when there is no table there", async () => {
    await expect(readTableFile(tablePath("papaoutai", dir))).rejects.toThrow(/papaoutai\.json/);
  });
});

describe("what goes into the local namespace", () => {
  it("stores the table under each song id it is given", () => {
    expect(bulkEntries("{}", ["papaoutai", "avenir"])).toEqual([
      { key: "papaoutai", value: "{}" },
      { key: "avenir", value: "{}" },
    ]);
  });

  // The e2e suite stores one table under all of them: which song is in play
  // depends on the day, and on LRCLIB answering for it at all.
  it("can cover every song the Worker might put in play, fallback included", () => {
    const ids = everySongId();

    expect(ids).toEqual(expect.arrayContaining(catalog.map((entry) => entry.id)));
    expect(ids).toContain(FALLBACK_SONG_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

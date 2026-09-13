import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFileFromExample } from "../../../scripts/lib/devVars";

let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "lyrix-dev-vars-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ensureFileFromExample", () => {
  it("creates the local file from the committed example", async () => {
    const example = join(dir, "create.example");
    const target = join(dir, "create.vars");
    await writeFile(example, "STATE_SECRET=dev-secret-change-me\n");

    expect(ensureFileFromExample(example, target)).toBe("created");
    expect(await readFile(target, "utf8")).toBe("STATE_SECRET=dev-secret-change-me\n");
  });

  it("never overwrites a file the developer already has", async () => {
    const example = join(dir, "keep.example");
    const target = join(dir, "keep.vars");
    await writeFile(example, "STATE_SECRET=dev-secret-change-me\n");
    await writeFile(target, "STATE_SECRET=my-own-secret\n");

    expect(ensureFileFromExample(example, target)).toBe("already-present");
    expect(await readFile(target, "utf8")).toBe("STATE_SECRET=my-own-secret\n");
  });

  it("reports a missing example rather than creating an empty file", async () => {
    const target = join(dir, "no-example.vars");
    expect(ensureFileFromExample(join(dir, "absent.example"), target)).toBe("no-example");
    await expect(readFile(target, "utf8")).rejects.toThrow();
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coverOverridesSource, OVERRIDES_MODULE } from "../../../scripts/embed-covers";

describe("covers supplied by hand", () => {
  it("are embedded in the Worker in step with worker/covers/ (npm run covers:embed)", () => {
    const written = readFileSync(OVERRIDES_MODULE, "utf8").replace(/\r\n/g, "\n");
    expect(written).toBe(coverOverridesSource());
  });
});

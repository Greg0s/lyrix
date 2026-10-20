import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPublishableContact } from "../../src/legal";

const root = join(__dirname, "../..");

describe("the legal page's contact", () => {
  it("takes a real address", () => {
    expect(isPublishableContact("contact@lyrix.fr")).toBe(true);
    expect(isPublishableContact("lyrix.jeu@outlook.fr")).toBe(true);
  });

  it("refuses a placeholder or something that isn't an address", () => {
    for (const email of [
      "contact@lyrix.invalid",
      "me@example.com",
      "me@mail.example",
      "me@lyrix.test",
      "me@localhost",
      "contact",
      "contact@lyrix",
      "con tact@lyrix.fr",
      "",
    ]) {
      expect(isPublishableContact(email)).toBe(false);
    }
  });

  it("is checked by the deploy before anything ships", () => {
    const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    const deploy = workflow.slice(workflow.indexOf("\n  deploy:"));
    expect(deploy.indexOf("npm run legal:check")).toBeGreaterThan(0);
    expect(deploy.indexOf("npm run legal:check")).toBeLessThan(deploy.indexOf("Deploy frontend"));
  });
});

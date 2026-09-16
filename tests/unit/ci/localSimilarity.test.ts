import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unstable_readConfig, type Unstable_Config } from "wrangler";
import {
  kvBulkPutArgs,
  LOCAL_SIMILARITY_CONFIG,
  LOCAL_SIMILARITY_PERSIST_DIR,
  SIMILARITY_BINDING,
  wranglerDevArgs,
} from "../../../scripts/lib/localSimilarity";
import { parseSimilarityTable, SIMILARITY_TABLE_VERSION } from "../../../worker/src/similarity";

/**
 * The configuration behind `npm run dev:similarity`: a KV namespace bound for
 * local play only.
 *
 * Two things have to stay true at once, and neither shows up in a diff. The
 * Worker that gets deployed must not gain a binding — a namespace id that
 * doesn't exist on the account fails the whole deploy, which is why this one
 * lives in a file `wrangler deploy` never opens. And the Worker being played
 * locally must otherwise be the Worker being shipped: a different entry point
 * or compatibility date would only tell on the day it reached production.
 */

/** What .github/workflows/ci.yml deploys, and what `npm run dev:all` runs. */
const DEPLOY_CONFIG = "worker/wrangler.toml";

/** Wrangler's own default state directory, which dev:all and dev:similarity share. */
const DEFAULT_STATE_DIR = "worker/.wrangler/state";

const E2E_TABLE = "tests/e2e/fixtures/similarity-table.json";

function read(path: string): Unstable_Config {
  return unstable_readConfig({ config: path }, { hideWarnings: true });
}

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function packageScripts(): Record<string, string> {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  return manifest.scripts;
}

describe("the Worker configuration that gets deployed", () => {
  it("binds no KV namespace, so no deploy can be pointed at a local-only one", () => {
    expect(read(DEPLOY_CONFIG).kv_namespaces).toEqual([]);
  });

  // wrangler warns on every `deploy` run against a configuration that defines
  // environments without being given one, so the local binding lives in its own
  // file rather than in an `[env.…]` section here.
  it("defines no environments, which every deploy would be warned about", () => {
    expect(readFileSync(DEPLOY_CONFIG, "utf8")).not.toMatch(/^\s*\[+env\./m);
  });
});

describe("the local similarity configuration", () => {
  const deployed = read(DEPLOY_CONFIG) as unknown as Record<string, unknown>;
  const local = read(LOCAL_SIMILARITY_CONFIG) as unknown as Record<string, unknown>;

  it("binds SIMILARITY to an id that could never be a real namespace", () => {
    const namespaces = read(LOCAL_SIMILARITY_CONFIG).kv_namespaces;
    expect(namespaces).toHaveLength(1);
    expect(namespaces[0].binding).toBe(SIMILARITY_BINDING);
    // A real namespace id is 32 hex characters. Anything else is rejected by
    // Cloudflare, so this configuration can only ever run locally.
    expect(namespaces[0].id).not.toMatch(/^[0-9a-f]{32}$/);
  });

  it("is otherwise the Worker that gets deployed, down to the compatibility date", () => {
    // Both files name the same entry point relative to the same directory, so
    // every resolved setting should match except the binding and which file it
    // was read from.
    const ignored = new Set(["configPath", "userConfigPath", "kv_namespaces"]);
    const keys = new Set([...Object.keys(deployed), ...Object.keys(local)]);
    const differences = [...keys].filter(
      (key) => !ignored.has(key) && JSON.stringify(deployed[key]) !== JSON.stringify(local[key])
    );

    expect(differences).toEqual([]);
  });
});

describe("loading a table and serving it", () => {
  it("send wrangler to the same configuration, binding and state directory", () => {
    // Two separate wrangler runs: a table loaded into a directory the Worker
    // doesn't read is silent — no error, just guesses without a score.
    const put = kvBulkPutArgs("bulk.json");
    const dev = wranglerDevArgs();

    expect(flagValue(put, "--config")).toBe(LOCAL_SIMILARITY_CONFIG);
    expect(flagValue(dev, "--config")).toBe(LOCAL_SIMILARITY_CONFIG);
    expect(flagValue(put, "--persist-to")).toBe(flagValue(dev, "--persist-to"));
    expect(flagValue(put, "--binding")).toBe(SIMILARITY_BINDING);
  });

  it("writes to local state, never to the account's KV", () => {
    expect(kvBulkPutArgs("bulk.json")).toContain("--local");
    expect(kvBulkPutArgs("bulk.json")).not.toContain("--remote");
  });

  // Placeholder scores in this mode would be indistinguishable from real ones
  // that failed to load — the whole point of the mode is to see the real table.
  it("never turns the placeholder table on", () => {
    expect(wranglerDevArgs({ reveal: true }).join(" ")).not.toContain("SIMILARITY_SAMPLE");
  });

  it("keeps loaded tables out of the state directory npm run dev:all writes to", () => {
    expect(LOCAL_SIMILARITY_PERSIST_DIR).not.toBe(DEFAULT_STATE_DIR);
  });
});

describe("npm run dev:all", () => {
  // Without a model and without a table, the game has to behave exactly as it
  // did before any of this existed.
  it("still runs the deployed configuration, on the placeholder table", () => {
    const devWorker = packageScripts()["dev:worker"];
    expect(devWorker).toContain(`--config ${DEPLOY_CONFIG}`);
    expect(devWorker).toContain("SIMILARITY_SAMPLE:1");
    expect(devWorker).not.toContain(LOCAL_SIMILARITY_CONFIG);
  });
});

// The e2e suite plays a Worker against this table, so a format change has to
// reach it too — here, in `npm test`, rather than as a webServer that won't start.
describe("the table the e2e suite loads", () => {
  it(`is a version ${SIMILARITY_TABLE_VERSION} table, as the Worker requires`, () => {
    const stored: unknown = JSON.parse(readFileSync(E2E_TABLE, "utf8"));
    expect(parseSimilarityTable(stored), `${E2E_TABLE} needs rebuilding for version ${SIMILARITY_TABLE_VERSION}`).not.toBeNull();
  });
});

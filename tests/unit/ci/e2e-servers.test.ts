import { readFileSync } from "node:fs";
import type { PlaywrightTestConfig } from "@playwright/test";
import type { UserConfig } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";

// Regression test for e2e runs passing against another checkout's code. The
// Playwright webServer entries polled the ports `npm run dev:all` binds (5173
// and 8787) with `reuseExistingServer: !process.env.CI`, so with several
// worktrees of the repo on one machine, `npm run test:e2e` in one of them ran
// every test against the frontend and Worker another one had left running.
// See docs/LEARNINGS.md.

// What `npm run dev:all` binds — in every checkout on the machine at once.
const DEV_WEB_PORT = 5173; // Vite's default, which .claude/launch.json expects
const DEV_WORKER_PORT = 8787; // wrangler dev's default, which vite.config.ts proxies to
const DEV_WORKER_INSPECTOR_PORT = 9229; // wrangler dev's default inspector port
const DEV_PORTS = [DEV_WEB_PORT, DEV_WORKER_PORT, DEV_WORKER_INSPECTOR_PORT];

type WebServer = Exclude<NonNullable<PlaywrightTestConfig["webServer"]>, readonly unknown[]>;

afterEach(() => {
  vi.unstubAllEnvs();
});

// Loaded with CI unset, as on a developer's machine: a CI runner has no
// servers lying around to reuse, so a reuse flag keyed on CI passes there
// whatever it does locally.
async function loadPlaywrightConfig(): Promise<PlaywrightTestConfig> {
  vi.stubEnv("CI", undefined);
  vi.resetModules();
  return (await import("../../../playwright.config")).default;
}

async function loadViteConfig(env: Record<string, string>): Promise<UserConfig> {
  vi.stubEnv("API_PROXY_TARGET", undefined);
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return (await import("../../../vite.config")).default;
}

function webServers(config: PlaywrightTestConfig): WebServer[] {
  return config.webServer === undefined ? [] : [config.webServer].flat();
}

// Looked up by npm script rather than by position: each server must start
// through the same script `npm run dev:all` uses, npm's pre-hooks included.
function serverStartedBy(config: PlaywrightTestConfig, script: string): WebServer {
  const matches = webServers(config).filter(
    (server) => server.command.trim().split(/\s+/).slice(0, 3).join(" ") === `npm run ${script}`
  );
  if (matches.length !== 1) {
    throw new Error(`expected exactly one webServer started with \`npm run ${script}\`, found ${matches.length}`);
  }
  return matches[0];
}

// npm only hands a script the arguments after `--`; anything before it is
// read as npm's own config and never reaches Vite or wrangler.
function forwardedArgs(command: string): string[] {
  const args = command.trim().split(/\s+/);
  const separator = args.indexOf("--");
  return separator === -1 ? [] : args.slice(separator + 1);
}

function forwardedFlag(command: string, name: string): string | undefined {
  const args = forwardedArgs(command);
  for (const [index, arg] of args.entries()) {
    if (arg === name) return args[index + 1];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

// The port a server ends up asking for: the flag's value, or the tool's default without one.
function requestedPort(command: string, flag: string, toolDefault: number): number {
  const value = forwardedFlag(command, flag);
  return value === undefined ? toolDefault : Number(value);
}

function readinessUrl(server: WebServer): URL {
  if (server.url === undefined) throw new Error(`\`${server.command}\` has no readiness url`);
  return new URL(server.url);
}

function apiProxyTarget(config: UserConfig): string {
  const target = config.server?.proxy?.["/api"];
  if (typeof target !== "string") throw new Error("expected vite.config.ts to proxy /api to a URL string");
  return target;
}

describe("Playwright e2e web servers", () => {
  it("never reuse a server that is already running", async () => {
    const servers = webServers(await loadPlaywrightConfig());

    expect(servers.length).toBeGreaterThan(0);
    for (const server of servers) {
      expect(server.reuseExistingServer ?? false, `\`${server.command}\` must start its own server`).toBe(false);
    }
  });

  it("run on ports `npm run dev:all` never uses", async () => {
    const config = await loadPlaywrightConfig();
    const web = serverStartedBy(config, "dev");
    const worker = serverStartedBy(config, "dev:worker");
    const e2ePorts = [
      requestedPort(web.command, "--port", DEV_WEB_PORT),
      requestedPort(worker.command, "--port", DEV_WORKER_PORT),
      requestedPort(worker.command, "--inspector-port", DEV_WORKER_INSPECTOR_PORT),
    ];

    for (const port of e2ePorts) expect(DEV_PORTS).not.toContain(port);
    expect(new Set(e2ePorts).size).toBe(e2ePorts.length);
  });

  it("wait on the same ports the servers are started on", async () => {
    const config = await loadPlaywrightConfig();
    const web = serverStartedBy(config, "dev");
    const worker = serverStartedBy(config, "dev:worker");

    expect(requestedPort(web.command, "--port", DEV_WEB_PORT)).toBe(Number(readinessUrl(web).port));
    // Without it, Vite moves to the next free port when its own is taken,
    // while Playwright keeps polling whatever holds the original one.
    expect(forwardedArgs(web.command)).toContain("--strictPort");
    expect(config.use?.baseURL).toBe(readinessUrl(web).origin);
    expect(requestedPort(worker.command, "--port", DEV_WORKER_PORT)).toBe(Number(readinessUrl(worker).port));
  });

  it("proxy the e2e frontend's /api calls to the e2e Worker", async () => {
    const config = await loadPlaywrightConfig();
    const web = serverStartedBy(config, "dev");
    const worker = serverStartedBy(config, "dev:worker");

    const viteConfig = await loadViteConfig(web.env ?? {});

    expect(new URL(apiProxyTarget(viteConfig)).origin).toBe(readinessUrl(worker).origin);
  });
});

describe("npm run dev:all", () => {
  it("keeps the frontend on 5173 and proxies /api to wrangler dev's default port", async () => {
    const launch: unknown = JSON.parse(readFileSync(new URL("../../../.claude/launch.json", import.meta.url), "utf-8"));
    expect(launch).toMatchObject({
      configurations: expect.arrayContaining([
        expect.objectContaining({ runtimeArgs: ["run", "dev:all"], port: DEV_WEB_PORT }),
      ]),
    });

    const viteConfig = await loadViteConfig({});

    expect(apiProxyTarget(viteConfig)).toBe(`http://localhost:${DEV_WORKER_PORT}`);
  });
});

import { utcDay } from "../../src/game/daily";

/**
 * `npm run canary` (scripts/canary.ts), run every day just after UTC
 * midnight by .github/workflows/canary.yml: is the site up, and does the
 * Worker hand out today's round? A failure fails the workflow, and GitHub
 * emails the repository's owner. It reads, never plays: a guess would be
 * counted as a player's round (worker/src/events.ts).
 */

export interface CanaryConfig {
  siteUrl: string;
  apiUrl: string;
}

/** The environment variables the canary reads (set by the workflow). */
export const CANARY_ENV = {
  CANARY_SITE_URL: "the site's address, e.g. https://lyrix-eyg.pages.dev",
  CANARY_API_URL: "the Worker's address, e.g. https://lyrix-api.lyrix.workers.dev",
} as const;

export function canaryConfig(env: Record<string, string | undefined>): CanaryConfig {
  const missing = (Object.keys(CANARY_ENV) as (keyof typeof CANARY_ENV)[]).filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `canary: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set.\n` +
        missing.map((name) => `  ${name}: ${CANARY_ENV[name]}`).join("\n")
    );
  }
  return { siteUrl: env.CANARY_SITE_URL ?? "", apiUrl: env.CANARY_API_URL ?? "" };
}

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

type Fetch = typeof fetch;

async function checkSite(config: CanaryConfig, fetchImpl: Fetch): Promise<CheckResult> {
  const name = "the site answers with the game";
  try {
    const response = await fetchImpl(new URL("/", config.siteUrl));
    const html = await response.text();
    if (!response.ok) return { name, ok: false, detail: `HTTP ${response.status}` };
    if (!/<title>[^<]*Lyrix/.test(html) || !/<script type="module"[^>]+src="\/assets\//.test(html)) {
      return { name, ok: false, detail: "the page isn't the game's built index.html" };
    }
    return { name, ok: true, detail: "HTTP 200" };
  } catch (error) {
    return { name, ok: false, detail: `no answer: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Whether `body` is a round of `day` a player could start on: sealed, with lyrics and a title to find. */
function roundProblem(body: unknown, day: string): string | null {
  if (typeof body !== "object" || body === null) return "the answer isn't a round";
  const round = body as Record<string, unknown>;
  if (typeof round.state !== "string" || round.state.length === 0) return "the round has no sealed state";
  if (round.day !== day) return `the round is ${String(round.day)}'s, not ${day}'s`;
  const title = typeof round.title === "object" && round.title !== null ? (round.title as Record<string, unknown>) : null;
  if (!title || !Array.isArray(title.tokens) || title.tokens.length === 0) return "the round has no title to find";
  if (!Array.isArray(round.sections) || round.sections.length === 0) return "the round has no lyrics";
  if (round.victory !== false) return "the round comes back won";
  return null;
}

async function checkRound(config: CanaryConfig, now: Date, fetchImpl: Fetch): Promise<CheckResult> {
  const day = utcDay(now);
  const name = `the Worker hands out ${day}'s round`;
  try {
    const response = await fetchImpl(new URL("/api/round", config.apiUrl));
    const text = await response.text();
    if (!response.ok) return { name, ok: false, detail: `HTTP ${response.status}: ${text.slice(0, 300)}` };
    const problem = roundProblem(JSON.parse(text), day);
    return problem ? { name, ok: false, detail: problem } : { name, ok: true, detail: "HTTP 200" };
  } catch (error) {
    return { name, ok: false, detail: `no answer: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Every check, once. */
export function runChecks(config: CanaryConfig, now: Date = new Date(), fetchImpl: Fetch = fetch): Promise<CheckResult[]> {
  return Promise.all([checkSite(config, fetchImpl), checkRound(config, now, fetchImpl)]);
}

/**
 * Every check, the failed ones tried again after `retryAfterMs`: a blip of
 * a few seconds isn't worth an email, a failure that lasts is.
 */
export async function runCanary(
  config: CanaryConfig,
  { now = new Date(), fetchImpl = fetch as Fetch, retryAfterMs = 60_000, wait = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {}
): Promise<CheckResult[]> {
  const first = await runChecks(config, now, fetchImpl);
  if (first.every((check) => check.ok)) return first;
  await wait(retryAfterMs);
  return runChecks(config, now, fetchImpl);
}

export function formatResults(results: readonly CheckResult[]): string {
  return results.map(({ name, ok, detail }) => `${ok ? "ok  " : "FAIL"}  ${name} (${detail})`).join("\n");
}

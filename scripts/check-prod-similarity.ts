import { parseArgs } from "node:util";
import {
  formatProbe,
  formatVerdict,
  judgeProbes,
  parseProbeAnswer,
  PROBE_WORDS,
  PRODUCTION_API,
  type ProbeAnswer,
} from "./lib/prodSimilarity";

/**
 * Plays a few words against the deployed Worker and says whether the day's song
 * is answered with proximity scores.
 *
 * Tables are uploaded to KV by hand and nothing in CI checks them (the model
 * isn't in the repository), so a song with no table only shows up as a round
 * where every missed guess scores nothing. This is the scripted way to look.
 * Each probe is sent from the round's fresh state: nothing is saved anywhere.
 *
 *   npm run similarity:check-prod
 *   npm run similarity:check-prod -- --day 2026-10-12
 *   npm run similarity:check-prod -- amour papa
 */

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${url} failed with status ${response.status}: ${await response.text()}`);
  return response.json();
}

async function fetchState(api: string, day: string | undefined): Promise<{ state: string; day: string }> {
  const url = day === undefined ? `${api}/api/round` : `${api}/api/round?day=${encodeURIComponent(day)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed with status ${response.status}: ${await response.text()}`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) throw new Error(`unexpected round from ${url}`);
  const { state, day: roundDay } = body as Record<string, unknown>;
  if (typeof state !== "string" || typeof roundDay !== "string") throw new Error(`unexpected round from ${url}`);
  return { state, day: roundDay };
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      day: { type: "string" },
      api: { type: "string", default: PRODUCTION_API },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.log(
      [
        "usage: check-prod-similarity [options] [word…]",
        "",
        `  word…          probes to send (default: ${PROBE_WORDS.join(", ")})`,
        "  --day <day>    a day of the archives (YYYY-MM-DD) instead of today",
        `  --api <url>    the Worker to ask (default: ${PRODUCTION_API})`,
      ].join("\n")
    );
    return;
  }

  const api = values.api.replace(/\/+$/, "");
  const words = positionals.length > 0 ? positionals : PROBE_WORDS;
  const round = await fetchState(api, values.day);
  console.log(`probing the round of ${round.day} on ${api}…`);

  const answers: ProbeAnswer[] = [];
  for (const word of words) {
    const answer = parseProbeAnswer(word, await postJson(`${api}/api/guess`, { state: round.state, word, delta: true }));
    console.log(formatProbe(answer));
    answers.push(answer);
  }

  const verdict = judgeProbes(answers);
  console.log(`\n${formatVerdict(verdict)}`);
  if (verdict.kind !== "scored") process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

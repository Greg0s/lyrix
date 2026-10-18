import type { NearSlot } from "../../src/game/types";

/** The Worker the production frontend calls (VITE_API_BASE_URL in .github/workflows/ci.yml). */
export const PRODUCTION_API = "https://lyrix-api.lyrix.workers.dev";

/**
 * Common French content words, each well inside the 50,000 most frequent words
 * of the model, so a song with a table scores every one it doesn't contain.
 * Several, because a probe the lyrics hold is revealed instead of scored.
 */
export const PROBE_WORDS = ["maison", "temps", "monde", "nuit", "coeur", "ville", "soleil", "route", "regard", "fenetre"];

/** What POST /api/guess answered for one probe: the fields a full view and a delta share. */
export interface ProbeAnswer {
  word: string;
  found: boolean;
  score: number | null;
  near: NearSlot[];
}

export type ProbeVerdict =
  /** At least one missed probe came back scored: the song has a usable table. */
  | { kind: "scored"; scored: number; misses: number; placed: number }
  /** Every missed probe came back unscored: no table for the song, or one of an older format. */
  | { kind: "unscored"; misses: number }
  /** Every probe was in the lyrics, so nothing could be scored. */
  | { kind: "inconclusive" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNearSlot(value: unknown): value is NearSlot {
  return isRecord(value) && typeof value.position === "number" && typeof value.score === "number";
}

/** Reads a POST /api/guess body, full view or delta alike; throws on anything else. */
export function parseProbeAnswer(word: string, body: unknown): ProbeAnswer {
  if (
    !isRecord(body) ||
    typeof body.found !== "boolean" ||
    !(body.score === null || typeof body.score === "number") ||
    !Array.isArray(body.near) ||
    !body.near.every(isNearSlot)
  ) {
    throw new Error(`unexpected answer to the guess "${word}": ${JSON.stringify(body)}`);
  }
  return { word, found: body.found, score: body.score, near: body.near };
}

export function judgeProbes(answers: readonly ProbeAnswer[]): ProbeVerdict {
  const misses = answers.filter((answer) => !answer.found);
  if (misses.length === 0) return { kind: "inconclusive" };
  const scored = misses.filter((answer) => answer.score !== null);
  if (scored.length === 0) return { kind: "unscored", misses: misses.length };
  const placed = scored.filter((answer) => answer.near.length > 0).length;
  return { kind: "scored", scored: scored.length, misses: misses.length, placed };
}

export function formatProbe(answer: ProbeAnswer): string {
  if (answer.found) return `  ${answer.word}: in the lyrics`;
  if (answer.score === null) return `  ${answer.word}: unscored`;
  const near = answer.near.length === 0 ? "placed nowhere" : `close to ${answer.near.length} hidden word(s)`;
  return `  ${answer.word}: ${answer.score}, ${near}`;
}

export function formatVerdict(verdict: ProbeVerdict): string {
  switch (verdict.kind) {
    case "scored":
      return `OK: ${verdict.scored}/${verdict.misses} missed probes scored, ${verdict.placed} placed on the lyrics`;
    case "unscored":
      return [
        `FAIL: all ${verdict.misses} missed probes came back unscored.`,
        "The SIMILARITY namespace holds no table for this song, or one of an older format.",
        "Rebuild and upload (docs/SIMILARITY.md, \"Pipeline\"):",
        "  npm run similarity:build -- --model data/models/frwac.vecbin --all --bulk",
        "  npx wrangler kv bulk put data/similarity/bulk.json --binding SIMILARITY --remote --config worker/wrangler.toml",
      ].join("\n");
    case "inconclusive":
      return "INCONCLUSIVE: every probe is in the lyrics — pass other words";
  }
}

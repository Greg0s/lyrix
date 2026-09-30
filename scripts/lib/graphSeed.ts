/**
 * graphify-out/graph.json is not committed: it is rebuilt from the code and
 * the committed semantic cache (graphify-out/cache/semantic/, the LLM
 * extraction of the docs). `graphify update` only re-extracts code and keeps
 * whatever non-code nodes the existing graph.json already holds, so on a fresh
 * clone it would silently drop every doc node. Seeding graph.json with the
 * cached extraction first makes the rebuild depend on committed inputs only.
 */

interface CacheEntry {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  hyperedges: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCacheEntry(value: unknown, name: string): CacheEntry {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error(`${name} has no \`nodes\`/\`edges\` arrays — not a graphify semantic cache entry`);
  }
  const nodes = value.nodes.filter(isRecord);
  if (nodes.some((node) => typeof node.id !== "string")) {
    throw new Error(`${name} has a node without a string \`id\``);
  }
  return {
    nodes,
    edges: value.edges.filter(isRecord),
    hyperedges: Array.isArray(value.hyperedges) ? value.hyperedges : [],
  };
}

/**
 * Builds graphify's node-link JSON out of semantic cache entries, keyed by
 * file name for error messages. A node extracted from several docs is kept
 * once (first entry wins, entries are taken in name order so the result
 * doesn't depend on directory listing order).
 */
export function seedGraphFromSemanticCache(entries: ReadonlyMap<string, unknown>): Record<string, unknown> {
  const nodes = new Map<string, Record<string, unknown>>();
  const links: Record<string, unknown>[] = [];
  const hyperedges: unknown[] = [];
  for (const name of [...entries.keys()].sort()) {
    const entry = parseCacheEntry(entries.get(name), name);
    for (const node of entry.nodes) {
      const id = node.id as string;
      if (!nodes.has(id)) nodes.set(id, { ...node, _origin: "semantic" });
    }
    links.push(...entry.edges.map((edge) => ({ ...edge, _origin: "semantic" })));
    hyperedges.push(...entry.hyperedges);
  }
  return { directed: false, multigraph: false, graph: {}, nodes: [...nodes.values()], links, hyperedges };
}

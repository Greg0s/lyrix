/**
 * Edges graphify's extractor gets wrong in this repo, removed from
 * graphify-out/graph.json after every rebuild (see docs/LEARNINGS.md,
 * 2026-09-29). Each one is matched exactly, so a real edge between the same
 * nodes under another relation survives.
 */
export interface KnownFalseEdge {
  source: string;
  target: string;
  relation: string;
  why: string;
}

export const KNOWN_FALSE_EDGES: readonly KnownFalseEdge[] = [
  {
    source: "src_game_normalize_normalize",
    target: "src_game_normalize_normalize",
    relation: "calls",
    why: 'word.normalize("NFD") is String.prototype.normalize, not a recursive call',
  },
];

interface GraphLink {
  source: string;
  target: string;
  relation: string;
}

function isGraphLink(value: unknown): value is GraphLink {
  if (typeof value !== "object" || value === null) return false;
  const link = value as Record<string, unknown>;
  return typeof link.source === "string" && typeof link.target === "string" && typeof link.relation === "string";
}

function matches(link: GraphLink, edge: KnownFalseEdge): boolean {
  if (link.relation !== edge.relation) return false;
  // graph.json is undirected: an edge may be stored either way round.
  return (
    (link.source === edge.source && link.target === edge.target) ||
    (link.source === edge.target && link.target === edge.source)
  );
}

/**
 * Returns graphify's node-link JSON without the known false edges, and how
 * many were dropped. Throws on a file that isn't graphify's format rather
 * than silently writing it back unchanged.
 */
export function dropKnownFalseEdges(
  graph: unknown,
  falseEdges: readonly KnownFalseEdge[] = KNOWN_FALSE_EDGES,
): { graph: Record<string, unknown>; dropped: number } {
  if (typeof graph !== "object" || graph === null || !Array.isArray((graph as Record<string, unknown>).links)) {
    throw new Error("graphify-out/graph.json has no `links` array — not a graphify node-link graph");
  }
  const record = graph as Record<string, unknown>;
  const links = record.links as unknown[];
  const kept = links.filter((link) => !(isGraphLink(link) && falseEdges.some((edge) => matches(link, edge))));
  return { graph: { ...record, links: kept }, dropped: links.length - kept.length };
}

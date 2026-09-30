import { describe, expect, it } from "vitest";
import { seedGraphFromSemanticCache } from "../../../scripts/lib/graphSeed";

const claudeMd = {
  nodes: [
    { id: "src_game_mask_buildroundview", label: "buildRoundView", source_file: "CLAUDE.md" },
    { id: "src_styles_tokens_css", label: "tokens.css", source_file: "CLAUDE.md" },
  ],
  edges: [{ source: "src_game_mask_buildroundview", target: "src_styles_tokens_css", relation: "references" }],
  hyperedges: [{ id: "h1", nodes: ["src_game_mask_buildroundview", "src_styles_tokens_css"] }],
};
const similarityMd = {
  nodes: [
    { id: "src_game_mask_buildroundview", label: "buildRoundView (again)", source_file: "docs/SIMILARITY.md" },
    { id: "src_game_slots_wordpositions", label: "wordPositions", source_file: "docs/SIMILARITY.md" },
  ],
  edges: [{ source: "src_game_slots_wordpositions", target: "src_game_mask_buildroundview", relation: "calls" }],
};

describe("seedGraphFromSemanticCache", () => {
  it("merges every cached doc extraction into one undirected node-link graph", () => {
    const graph = seedGraphFromSemanticCache(
      new Map<string, unknown>([
        ["p/a.json", claudeMd],
        ["p/b.json", similarityMd],
      ]),
    );

    expect(graph).toMatchObject({ directed: false, multigraph: false, graph: {} });
    expect(graph.nodes).toEqual([
      { ...claudeMd.nodes[0], _origin: "semantic" },
      { ...claudeMd.nodes[1], _origin: "semantic" },
      { ...similarityMd.nodes[1], _origin: "semantic" },
    ]);
    expect(graph.links).toEqual([
      { ...claudeMd.edges[0], _origin: "semantic" },
      { ...similarityMd.edges[0], _origin: "semantic" },
    ]);
    expect(graph.hyperedges).toEqual(claudeMd.hyperedges);
  });

  it("does not depend on the order the cache directory is listed in", () => {
    const forward = seedGraphFromSemanticCache(
      new Map<string, unknown>([
        ["p/a.json", claudeMd],
        ["p/b.json", similarityMd],
      ]),
    );
    const backward = seedGraphFromSemanticCache(
      new Map<string, unknown>([
        ["p/b.json", similarityMd],
        ["p/a.json", claudeMd],
      ]),
    );

    expect(backward).toEqual(forward);
  });

  it("seeds an empty graph from an empty cache", () => {
    expect(seedGraphFromSemanticCache(new Map())).toMatchObject({ nodes: [], links: [], hyperedges: [] });
  });

  it("refuses a file that isn't a semantic cache entry, naming it", () => {
    expect(() => seedGraphFromSemanticCache(new Map([["p/x.json", { nodes: [] }]]))).toThrow(/p\/x\.json/);
    expect(() => seedGraphFromSemanticCache(new Map([["p/y.json", { nodes: [{ label: "no id" }], edges: [] }]]))).toThrow(
      /p\/y\.json has a node without a string `id`/,
    );
  });
});

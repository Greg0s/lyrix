import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dropKnownFalseEdges, KNOWN_FALSE_EDGES } from "../../../scripts/lib/graphFixes";

const selfLoop = {
  source: "src_game_normalize_normalize",
  target: "src_game_normalize_normalize",
  relation: "calls",
  source_location: "L7",
};
const realCall = {
  source: "src_game_analyze_analyzeline",
  target: "src_game_normalize_normalize",
  relation: "calls",
};

describe("dropKnownFalseEdges", () => {
  it("drops the normalize() self-loop graphify re-adds on every update", () => {
    const { graph, dropped } = dropKnownFalseEdges({ directed: false, nodes: [], links: [selfLoop, realCall] });

    expect(dropped).toBe(1);
    expect(graph.links).toEqual([realCall]);
    expect(graph.directed).toBe(false);
  });

  it("matches an undirected edge stored either way round, and only under its relation", () => {
    const edge = { source: "a", target: "b", relation: "calls", why: "test" };
    const { graph, dropped } = dropKnownFalseEdges(
      {
        links: [
          { source: "b", target: "a", relation: "calls" },
          { source: "a", target: "b", relation: "contains" },
        ],
      },
      [edge],
    );

    expect(dropped).toBe(1);
    expect(graph.links).toEqual([{ source: "a", target: "b", relation: "contains" }]);
  });

  it("is a no-op on a graph that is already clean", () => {
    expect(dropKnownFalseEdges({ links: [realCall] }).dropped).toBe(0);
  });

  it("refuses a file that isn't graphify's node-link format", () => {
    expect(() => dropKnownFalseEdges({ nodes: [] })).toThrow(/no `links` array/);
  });

  it("leaves none of the known false edges in the committed graph", () => {
    const committed: unknown = JSON.parse(readFileSync("graphify-out/graph.json", "utf8"));

    expect(dropKnownFalseEdges(committed, KNOWN_FALSE_EDGES).dropped).toBe(0);
  });
});

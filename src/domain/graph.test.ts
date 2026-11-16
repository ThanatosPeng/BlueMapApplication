import { describe, expect, it } from "vitest";
import { canConnect, detectCycle, downstreamCount, topoOrder } from "./graph";
import { levelOf, statusOf, xpOf } from "./mastery";
import { SEED_BLUEPRINTS } from "../data";
import type { GraphEdge, NodeState } from "./types";

const edge = (id: string, from: string, to: string): GraphEdge => ({
  id,
  from,
  to,
  kind: "hard",
});

const state = (mastery: number): NodeState => ({
  mastery,
  note: "",
  dueAt: null,
  intervalDays: 0,
  evidence: { self: false, quiz: false, artifact: false, ai: false },
});

describe("graph", () => {
  it("detects cycles but passes DAGs", () => {
    const dag = [edge("1", "a", "b"), edge("2", "b", "c")];
    expect(detectCycle(dag)).toBe(false);
    expect(detectCycle([...dag, edge("3", "c", "a")])).toBe(true);
  });

  it("counts downstream nodes once, even with diamond paths", () => {
    const edges = [
      edge("1", "a", "b"),
      edge("2", "a", "c"),
      edge("3", "b", "d"),
      edge("4", "c", "d"),
    ];
    expect(downstreamCount(edges, "a")).toBe(3);
    expect(downstreamCount(edges, "d")).toBe(0);
  });

  it("rejects self / duplicate / cyclic connections", () => {
    const edges = [edge("1", "a", "b"), edge("2", "b", "c")];
    expect(canConnect(edges, "a", "a").ok).toBe(false);
    expect(canConnect(edges, "a", "b").ok).toBe(false);
    expect(canConnect(edges, "c", "a").ok).toBe(false);
    expect(canConnect(edges, "a", "c").ok).toBe(true);
  });

  it("returns null topo order when a cycle exists", () => {
    expect(topoOrder([edge("1", "a", "b")], ["a", "b"])).toEqual(["a", "b"]);
    expect(topoOrder([edge("1", "a", "b"), edge("2", "b", "a")], ["a", "b"])).toBeNull();
  });
});

describe("mastery", () => {
  const edges = [edge("1", "a", "b"), edge("2", "b", "c")];

  it("derives the five statuses", () => {
    const states: Record<string, NodeState> = {
      a: state(4),
      b: state(2),
      c: state(0),
    };
    expect(statusOf("a", edges, states)).toBe("mastered");
    expect(statusOf("b", edges, states)).toBe("learning");
    expect(statusOf("c", edges, states)).toBe("locked");
  });

  it("unlocks at mastery 3 of every prerequisite", () => {
    const states: Record<string, NodeState> = { a: state(3), b: state(0), c: state(0) };
    expect(statusOf("b", edges, states)).toBe("available");
    expect(statusOf("c", edges, states)).toBe("locked");
  });

  it("marks mastered nodes as review once due", () => {
    const due = { ...state(5), dueAt: Date.now() - 1000 };
    expect(statusOf("a", [], { a: due })).toBe("review");
  });

  it("computes xp and level deterministically", () => {
    const nodes = SEED_BLUEPRINTS[3].nodes; // 软件工程
    const states: Record<string, NodeState> = Object.fromEntries(
      nodes.map((n) => [n.id, state(n.id === "prog-basic" ? 5 : 0)]),
    );
    expect(xpOf(nodes, states)).toBe(5 * 18 + 22);
    expect(levelOf(112).level).toBe(2);
    expect(levelOf(0).level).toBe(1);
  });
});

describe("seed blueprints", () => {
  it("ships four acyclic blueprints with forward-only edges", () => {
    expect(SEED_BLUEPRINTS.map((b) => b.id)).toEqual(["emb", "vue", "react", "se"]);
    for (const bp of SEED_BLUEPRINTS) {
      expect(bp.nodes.length).toBeGreaterThan(15);
      expect(detectCycle(bp.edges)).toBe(false);
      const tierOf = new Map(bp.nodes.map((n) => [n.id, n.tier]));
      for (const e of bp.edges) {
        expect(tierOf.get(e.from)!).toBeLessThan(tierOf.get(e.to)!);
      }
    }
  });
});

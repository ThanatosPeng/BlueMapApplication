import { describe, expect, it } from "vitest";
import { addEdge, addNode, removeEdge, removeNode, updateNode } from "./edit";
import { detectCycle } from "./graph";
import { SEED_BLUEPRINTS } from "../data";
import type { GraphNode } from "./types";

const base = SEED_BLUEPRINTS[0]; // 嵌入式

const node = (id: string): GraphNode => ({
  id,
  title: id,
  sub: "",
  type: "concept",
  tier: 9,
  row: 9,
  resources: [],
});

describe("blueprint editing", () => {
  it("adds a node without touching existing ones", () => {
    const next = addNode(base, node("new-1"));
    expect(next.nodes).toHaveLength(base.nodes.length + 1);
    expect(base.nodes.find((n) => n.id === "new-1")).toBeUndefined();
  });

  it("removes a node and every edge that touches it", () => {
    const target = "emb-gpio";
    const touching = base.edges.filter((e) => e.from === target || e.to === target);
    expect(touching.length).toBeGreaterThan(0);

    const next = removeNode(base, target);
    expect(next.nodes.find((n) => n.id === target)).toBeUndefined();
    expect(next.edges.some((e) => e.from === target || e.to === target)).toBe(false);
    expect(next.edges).toHaveLength(base.edges.length - touching.length);
  });

  it("rejects cycles, duplicates and self-loops", () => {
    const dag = addEdge(base, "emb-c", "emb-periph");
    expect(dag.ok).toBe(true);
    // 重复
    expect(addEdge(dag.doc, "emb-c", "emb-periph").ok).toBe(false);
    // 自连
    expect(addEdge(base, "emb-c", "emb-c").ok).toBe(false);
    // 成环：periph 已经是 c 的下游，再连回去
    expect(detectCycle(dag.doc.edges)).toBe(false);
    expect(addEdge(dag.doc, "emb-periph", "emb-c").ok).toBe(false);
  });

  it("keeps the graph acyclic after a valid insertion", () => {
    const res = addEdge(base, "emb-c", "emb-rtos");
    expect(res.ok).toBe(true);
    expect(detectCycle(res.doc.edges)).toBe(false);
    expect(res.doc.edges).toHaveLength(base.edges.length + 1);
  });

  it("removes an edge by id", () => {
    const first = base.edges[0];
    const next = removeEdge(base, first.id);
    expect(next.edges.find((e) => e.id === first.id)).toBeUndefined();
  });

  it("patches node fields without mutating the original", () => {
    const next = updateNode(base, "emb-c", { title: "C 语言深入", hours: 60 });
    expect(next.nodes.find((n) => n.id === "emb-c")?.title).toBe("C 语言深入");
    expect(base.nodes.find((n) => n.id === "emb-c")?.title).toBe("C 语言与内存");
  });
});

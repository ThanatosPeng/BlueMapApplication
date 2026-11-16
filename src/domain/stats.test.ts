import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";
import { SEED_BLUEPRINTS, seedNodeStates } from "../data";
import type { NodeState } from "./types";

const bp = SEED_BLUEPRINTS[0]; // 嵌入式：21 节点，2 个已掌握

const withStates = (patch: Record<string, Partial<NodeState>>) => {
  const states = seedNodeStates(bp);
  for (const [id, p] of Object.entries(patch)) {
    states[id] = { ...states[id], ...p };
  }
  return states;
};

describe("computeStats", () => {
  it("counts the snapshot buckets", () => {
    const stats = computeStats(bp, seedNodeStates(bp));
    expect(stats.total).toBe(bp.nodes.length);
    expect(stats.mastered + stats.learning + stats.available + stats.locked).toBe(stats.total);
    expect(stats.mastered).toBe(2);
    expect(stats.avgMastery).toBeGreaterThan(0);
  });

  it("sums remaining hours for everything not lit", () => {
    const stats = computeStats(bp, seedNodeStates(bp));
    const expected = bp.nodes
      .filter((n) => (seedNodeStates(bp)[n.id]?.mastery ?? 0) < 4)
      .reduce((sum, n) => sum + (n.hours ?? 0), 0);
    expect(stats.hoursLeft).toBe(expected);
  });

  it("counts only lights from the last 7 days", () => {
    const now = Date.now();
    const states = withStates({
      "emb-c": { mastery: 4, litAt: now - 2 * 86400000 },
      "emb-gpio": { mastery: 4, litAt: now - 30 * 86400000 },
    });
    const stats = computeStats(bp, states, now);
    expect(stats.weeklyLit).toBe(1);
  });

  it("counts due reviews and the worst overdue gap", () => {
    const now = Date.now();
    const states = withStates({
      "emb-c": { mastery: 4, dueAt: now - 3 * 86400000 },
      "emb-gpio": { mastery: 4, dueAt: now - 1 * 86400000 },
    });
    const stats = computeStats(bp, states, now);
    expect(stats.due).toBe(2);
    expect(stats.overdueDays).toBe(3);
  });

  it("picks bottlenecks among learning nodes by leverage", () => {
    const stats = computeStats(bp, seedNodeStates(bp));
    expect(stats.bottlenecks.length).toBeGreaterThan(0);
    expect(stats.bottlenecks.length).toBeLessThanOrEqual(3);
    for (const item of stats.bottlenecks) {
      const node = bp.nodes.find((n) => n.id === item.nodeId)!;
      expect(node).toBeTruthy();
      expect(item.mastery).toBeGreaterThan(0);
      expect(item.mastery).toBeLessThan(4);
    }
    // 按下游数量降序
    const leverages = stats.bottlenecks.map((b) => b.leverage);
    expect([...leverages].sort((a, b) => b - a)).toEqual(leverages);
  });

  it("groups progress by tier", () => {
    const stats = computeStats(bp, seedNodeStates(bp));
    expect(stats.byTier[0].tier).toBe(0);
    const total = stats.byTier.reduce((sum, t) => sum + t.total, 0);
    expect(total).toBe(bp.nodes.length);
  });

  it("handles an empty blueprint", () => {
    const stats = computeStats({ ...bp, nodes: [], edges: [] }, {});
    expect(stats.total).toBe(0);
    expect(stats.avgMastery).toBe(0);
    expect(stats.bottlenecks).toEqual([]);
  });
});

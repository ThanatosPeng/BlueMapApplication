import { describe, expect, it } from "vitest";
import { evaluateAchievements, unlockedCount } from "./achievements";
import { SEED_BLUEPRINTS, seedNodeStates } from "../data";
import type { NodeState } from "./types";

const bp = SEED_BLUEPRINTS[0]; // 嵌入式：21 节点，2 个已掌握

const lit = (states: Record<string, NodeState>, ids: string[]) => {
  for (const id of ids) states[id] = { ...states[id], mastery: 4, litAt: Date.now() };
  return states;
};

describe("achievements", () => {
  it("unlocks the first-light badge on the seed data", () => {
    const items = evaluateAchievements(bp, seedNodeStates(bp));
    const first = items.find((a) => a.id === "first-light")!;
    expect(first.unlocked).toBe(true);
    expect(first.current).toBe(1);
  });

  it("keeps the rest locked and reports progress", () => {
    const items = evaluateAchievements(bp, seedNodeStates(bp));
    const ten = items.find((a) => a.id === "ten-lights")!;
    expect(ten.unlocked).toBe(false);
    expect(ten.current).toBe(2);
    expect(ten.target).toBe(10);
  });

  it("unlocks ten-lights after ten nodes are lit", () => {
    const states = seedNodeStates(bp);
    lit(states, bp.nodes.slice(0, 10).map((n) => n.id));

    const items = evaluateAchievements(bp, states);
    expect(items.find((a) => a.id === "ten-lights")!.unlocked).toBe(true);
  });

  it("unlocks 地基完工 only when every tier-0 node is lit", () => {
    const states = seedNodeStates(bp);
    const tier0 = bp.nodes.filter((n) => n.tier === 0);

    lit(states, tier0.slice(0, tier0.length - 1).map((n) => n.id));
    let items = evaluateAchievements(bp, states);
    expect(items.find((a) => a.id === "tier0-clear")!.unlocked).toBe(false);

    lit(states, [tier0[tier0.length - 1].id]);
    items = evaluateAchievements(bp, states);
    expect(items.find((a) => a.id === "tier0-clear")!.unlocked).toBe(true);
  });

  it("unlocks the milestone badge when a milestone node is lit", () => {
    const states = seedNodeStates(bp);
    const milestone = bp.nodes.find((n) => n.type === "milestone")!;
    lit(states, [milestone.id]);

    const items = evaluateAchievements(bp, states);
    expect(items.find((a) => a.id === "milestone")!.unlocked).toBe(true);
  });

  it("counts unlocked badges", () => {
    const items = evaluateAchievements(bp, seedNodeStates(bp));
    expect(unlockedCount(items)).toBeGreaterThanOrEqual(1);
    expect(unlockedCount(items)).toBeLessThan(items.length);
  });
});

import { prerequisites } from "./graph";
import type { Evidence, GraphEdge, GraphNode, NodeState, NodeStatus } from "./types";

/** 前置掌握度达到这个值才解锁 */
export const UNLOCK_THRESHOLD = 3;
/** 达到这个值才算「点亮」（视觉上的已完成） */
export const LIGHT_THRESHOLD = 4;

export function masteryOf(states: Record<string, NodeState>, nodeId: string): number {
  return states[nodeId]?.mastery ?? 0;
}

export function isDue(state: NodeState | undefined, now = Date.now()): boolean {
  return !!state?.dueAt && state.dueAt <= now;
}

export function statusOf(
  nodeId: string,
  edges: GraphEdge[],
  states: Record<string, NodeState>,
  now = Date.now(),
): NodeStatus {
  const state = states[nodeId];
  const mastery = state?.mastery ?? 0;
  if (mastery >= LIGHT_THRESHOLD) return isDue(state, now) ? "review" : "mastered";
  if (mastery > 0) return "learning";
  const ready = prerequisites(edges, nodeId).every(
    (p) => masteryOf(states, p) >= UNLOCK_THRESHOLD,
  );
  return ready ? "available" : "locked";
}

/** 四类证据加权：自评 20% · 测验 40% · 产出 25% · AI 15% */
export function evidenceScore(ev: Evidence): number {
  return (
    (ev.self ? 0.2 : 0) + (ev.quiz ? 0.4 : 0) + (ev.artifact ? 0.25 : 0) + (ev.ai ? 0.15 : 0)
  );
}

export function xpOf(nodes: GraphNode[], states: Record<string, NodeState>): number {
  let xp = 0;
  for (const n of nodes) {
    const m = Math.round(masteryOf(states, n.id));
    xp += m * 18;
    if (m >= LIGHT_THRESHOLD) {
      xp += 22;
      if (n.type === "milestone") xp += 50;
    }
  }
  return xp;
}

export interface LevelInfo {
  level: number;
  prev: number;
  next: number;
  pct: number;
}

export function levelOf(xp: number): LevelInfo {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const prev = (level - 1) ** 2 * 50;
  const next = level ** 2 * 50;
  return {
    level,
    prev,
    next,
    pct: Math.min(1, Math.max(0, (xp - prev) / Math.max(1, next - prev))),
  };
}

export function suggestMastery(ev: Evidence): number {
  return Math.min(5, Math.max(0, Math.round(evidenceScore(ev) * 5)));
}

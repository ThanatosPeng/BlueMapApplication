import { dependents, downstreamCount } from "./graph";
import { masteryOf, statusOf } from "./mastery";
import type { Blueprint, NodeState } from "./types";

export interface Suggestion {
  nodeId: string;
  title: string;
  score: number;
  reason: string;
}

/**
 * 推荐理由用模板生成，不交给模型编 —— 理由必须可验证。
 * 排序权重：解锁价值（下游数量）为主，工时与里程碑做修正。
 */
export function reasonFor(bp: Blueprint, nodeId: string): string {
  const node = bp.nodes.find((n) => n.id === nodeId);
  if (!node) return "";
  const leverage = downstreamCount(bp.edges, nodeId);
  if (node.type === "milestone") return "里程碑 · 直接验收综合能力";
  if (leverage >= 3) return `后续 ${leverage} 个节点受益，主干路径`;
  if (leverage >= 1) {
    const next = dependents(bp.edges, nodeId)[0];
    const title = bp.nodes.find((n) => n.id === next)?.title;
    return title ? `通往「${title}」` : `后续 ${leverage} 个节点受益`;
  }
  return "补齐基础，暂无强依赖";
}

export function suggest(
  bp: Blueprint,
  states: Record<string, NodeState>,
  limit = 3,
): Suggestion[] {
  return bp.nodes
    .filter((n) => statusOf(n.id, bp.edges, states) === "available")
    .map((n) => ({
      nodeId: n.id,
      title: n.title,
      score:
        downstreamCount(bp.edges, n.id) * 2.4 -
        (n.hours ?? 0) * 0.06 +
        (n.type === "milestone" ? 3 : 0),
      reason: reasonFor(bp, n.id),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function learningNodes(bp: Blueprint, states: Record<string, NodeState>) {
  return bp.nodes
    .filter((n) => statusOf(n.id, bp.edges, states) === "learning")
    .sort(
      (a, b) =>
        downstreamCount(bp.edges, b.id) - downstreamCount(bp.edges, a.id),
    );
}

export function masteredCount(bp: Blueprint, states: Record<string, NodeState>): number {
  return bp.nodes.filter((n) => masteryOf(states, n.id) >= 4).length;
}

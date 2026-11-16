import { downstreamCount } from "./graph";
import { LIGHT_THRESHOLD, masteryOf, statusOf } from "./mastery";
import type { Blueprint, NodeState } from "./types";

const DAY = 86400000;

export interface Bottleneck {
  nodeId: string;
  title: string;
  mastery: number;
  leverage: number;
}

export interface TierProgress {
  tier: number;
  total: number;
  mastered: number;
}

export interface StatsSnapshot {
  total: number;
  mastered: number;
  learning: number;
  available: number;
  locked: number;
  /** 复习到期数（含已过期的 mastered 节点） */
  due: number;
  /** 最长逾期天数 */
  overdueDays: number;
  /** 距「全部点亮」还差多少小时 */
  hoursLeft: number;
  /** 最近 7 天点亮的节点数 */
  weeklyLit: number;
  /** 全图平均掌握度 0–5 */
  avgMastery: number;
  /** 卡住的节点：有进度但推进最慢、且下游影响大 */
  bottlenecks: Bottleneck[];
  byTier: TierProgress[];
}

/**
 * 复盘数字全部来自当前快照（不依赖事件日志），唯一的时间维度是 `litAt`。
 * 这样统计是纯函数，可单测、可离线算、也不怕历史数据被删。
 */
export function computeStats(
  bp: Blueprint,
  states: Record<string, NodeState>,
  now = Date.now(),
): StatsSnapshot {
  let mastered = 0;
  let learning = 0;
  let available = 0;
  let locked = 0;
  let due = 0;
  let overdueDays = 0;
  let hoursLeft = 0;
  let weeklyLit = 0;
  let masterySum = 0;

  const stalled: Bottleneck[] = [];
  const tierMap = new Map<number, TierProgress>();

  for (const node of bp.nodes) {
    const state = states[node.id];
    const mastery = masteryOf(states, node.id);
    masterySum += mastery;

    const status = statusOf(node.id, bp.edges, states, now);
    if (status === "mastered" || status === "review") {
      mastered++;
      if (state?.litAt && now - state.litAt <= 7 * DAY) weeklyLit++;
      if (status === "review") {
        due++;
        if (state?.dueAt) {
          overdueDays = Math.max(overdueDays, Math.floor((now - state.dueAt) / DAY));
        }
      }
    } else if (status === "learning") {
      learning++;
      stalled.push({
        nodeId: node.id,
        title: node.title,
        mastery,
        leverage: downstreamCount(bp.edges, node.id),
      });
    } else if (status === "available") {
      available++;
    } else {
      locked++;
    }

    if (mastery < LIGHT_THRESHOLD) hoursLeft += node.hours ?? 0;

    const tier = tierMap.get(node.tier) ?? { tier: node.tier, total: 0, mastered: 0 };
    tier.total++;
    if (mastery >= LIGHT_THRESHOLD) tier.mastered++;
    tierMap.set(node.tier, tier);
  }

  const total = bp.nodes.length;

  return {
    total,
    mastered,
    learning,
    available,
    locked,
    due,
    overdueDays,
    hoursLeft,
    weeklyLit,
    avgMastery: total ? Math.round((masterySum / total) * 10) / 10 : 0,
    bottlenecks: stalled
      .sort((a, b) => b.leverage - a.leverage || a.mastery - b.mastery)
      .slice(0, 3),
    byTier: Array.from(tierMap.values()).sort((a, b) => a.tier - b.tier),
  };
}

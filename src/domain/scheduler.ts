import type { NodeState } from "./types";

export type ReviewResult = "again" | "hard" | "good";

const DAY = 86400000;

/** 掌握度 → 初始复习间隔（天），SM-2 简化版 */
export function intervalForMastery(mastery: number): number {
  const table = [1, 1, 3, 7, 16, 35];
  return table[Math.min(5, Math.max(0, Math.round(mastery)))];
}

/**
 * 复习结果落库：
 * - again：间隔归 1 天、掌握度 −1（不低于 2）、lapse +1
 * - hard ：间隔 ×1.2
 * - good ：间隔 ×2.2（上限 75 天）、掌握度 +1（上限 5）
 */
export function applyReview(
  state: NodeState,
  result: ReviewResult,
  now = Date.now(),
): NodeState {
  const interval = state.intervalDays > 0 ? state.intervalDays : intervalForMastery(state.mastery);
  if (result === "again") {
    return {
      ...state,
      mastery: Math.max(2, state.mastery - 1),
      intervalDays: 1,
      dueAt: now + DAY,
    };
  }
  if (result === "hard") {
    const next = Math.min(75, Math.max(1, Math.round(interval * 1.2)));
    return { ...state, intervalDays: next, dueAt: now + next * DAY };
  }
  const next = Math.min(75, Math.max(1, Math.round(interval * 2.2)));
  return {
    ...state,
    mastery: Math.min(5, state.mastery + 1),
    intervalDays: next,
    dueAt: now + next * DAY,
  };
}

/** 点亮一个节点时，自动排一次复习 */
export function scheduleAfterLight(state: NodeState, now = Date.now()): NodeState {
  const interval = Math.max(state.intervalDays, 7);
  return { ...state, intervalDays: interval, dueAt: now + interval * DAY };
}

export function dueNodes(
  states: Record<string, NodeState>,
  now = Date.now(),
): string[] {
  return Object.entries(states)
    .filter(([, s]) => !!s.dueAt && s.dueAt <= now)
    .sort((a, b) => (a[1].dueAt ?? 0) - (b[1].dueAt ?? 0))
    .map(([id]) => id);
}

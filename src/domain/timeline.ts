import type { NodeState } from "./types";

export interface LitMoment {
  id: string;
  at: number;
}

/** 所有点亮事件，按时间升序 —— 时间轴播放的唯一数据源 */
export function litMoments(states: Record<string, NodeState>): LitMoment[] {
  return Object.entries(states)
    .filter(([, s]) => typeof s.litAt === "number")
    .map(([id, s]) => ({ id, at: s.litAt as number }))
    .sort((a, b) => a.at - b.at);
}

export interface TimelineRange {
  start: number;
  end: number;
  count: number;
}

/** 少于 2 个点亮事件就没有「过程」可放，返回 null */
export function timelineRange(
  states: Record<string, NodeState>,
  now = Date.now(),
): TimelineRange | null {
  const moments = litMoments(states);
  if (moments.length < 2) return null;
  return { start: moments[0].at, end: Math.max(now, moments[moments.length - 1].at), count: moments.length };
}

/** 在时刻 at，哪些节点已经点亮 */
export function litIdsAt(states: Record<string, NodeState>, at: number): Set<string> {
  const ids = new Set<string>();
  for (const moment of litMoments(states)) {
    if (moment.at <= at) ids.add(moment.id);
    else break;
  }
  return ids;
}

/** 把 0–1 的进度映射成时间戳，供播放条使用 */
export function timeAtProgress(range: TimelineRange, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return range.start + (range.end - range.start) * clamped;
}

export function progressAtTime(range: TimelineRange, at: number): number {
  if (range.end === range.start) return 1;
  return Math.min(1, Math.max(0, (at - range.start) / (range.end - range.start)));
}

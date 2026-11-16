import { masteryOf, LIGHT_THRESHOLD } from "./mastery";
import { computeStats } from "./stats";
import type { Blueprint, NodeState } from "./types";

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  current: number;
  target: number;
  unlocked: boolean;
}

function make(
  id: string,
  title: string,
  desc: string,
  current: number,
  target: number,
): Achievement {
  return {
    id,
    title,
    desc,
    current: Math.min(current, target),
    target,
    unlocked: current >= target,
  };
}

/**
 * 成就全部由当前快照推导，不额外存表：
 * 解锁了就一直在（因为掌握度不会无痛回退），也不需要迁移历史数据。
 */
export function evaluateAchievements(
  bp: Blueprint,
  states: Record<string, NodeState>,
  now = Date.now(),
): Achievement[] {
  const stats = computeStats(bp, states, now);
  const lit = (id: string) => masteryOf(states, id) >= LIGHT_THRESHOLD;

  const tier0 = bp.nodes.filter((n) => n.tier === 0);
  const tier0Done = tier0.filter((n) => lit(n.id)).length;
  const milestones = bp.nodes.filter((n) => n.type === "milestone");
  const milestoneDone = milestones.filter((n) => lit(n.id)).length;

  return [
    make("first-light", "第一盏灯", "点亮任意一个节点", stats.mastered, 1),
    make("ten-lights", "十盏灯", "同一张蓝图点亮 10 个节点", stats.mastered, 10),
    make("half-way", "过半", "点亮这张蓝图一半的节点", stats.mastered, Math.ceil(bp.nodes.length / 2)),
    make("tier0-clear", "地基完工", "第一层节点全部点亮", tier0Done, Math.max(1, tier0.length)),
    make("milestone", "里程碑", "完成一个里程碑节点", milestoneDone, 1),
    make("weekly-3", "一周三连", "7 天内点亮 3 个节点", stats.weeklyLit, 3),
  ];
}

export function unlockedCount(items: Achievement[]): number {
  return items.filter((a) => a.unlocked).length;
}

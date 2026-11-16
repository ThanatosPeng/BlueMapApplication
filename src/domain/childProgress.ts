import type { Blueprint, ProgressDoc } from "./types";
import type { CrossLink } from "./links";
import { LIGHT_THRESHOLD, masteryOf } from "./mastery";

export interface ChildNodeSummary {
  id: string;
  title: string;
  mastery: number;
  done: boolean;
}

export interface ChildSummary {
  bpId: string;
  title: string;
  nodes: ChildNodeSummary[];
  total: number;
  doneCount: number;
  /** 0-100，按节点平均掌握度算，不是简单的完成数占比 */
  percent: number;
  allDone: boolean;
}

/** 节点挂了哪张子蓝图（蓝图级关联，toNode 为空） */
export function childLinkForNode(
  links: CrossLink[],
  bpId: string,
  nodeId: string,
): CrossLink | null {
  return (
    links.find((l) => l.fromBp === bpId && l.fromNode === nodeId && l.toBp && !l.toNode) ?? null
  );
}

/** 「完成」= 点亮，即掌握度 ≥ 4 */
export function isChildNodeDone(mastery: number): boolean {
  return mastery >= LIGHT_THRESHOLD;
}

export function summarizeChild(
  bpId: string,
  doc: Blueprint,
  progress: ProgressDoc,
  title?: string,
): ChildSummary {
  const nodes: ChildNodeSummary[] = doc.nodes.map((node) => {
    const mastery = masteryOf(progress.nodes, node.id);
    return { id: node.id, title: node.title, mastery, done: isChildNodeDone(mastery) };
  });

  const total = nodes.length;
  const doneCount = nodes.filter((n) => n.done).length;
  const sum = nodes.reduce((acc, n) => acc + Math.min(n.mastery, 5), 0);
  const percent = total === 0 ? 0 : Math.round((sum / (total * 5)) * 100);

  return {
    bpId,
    title: title ?? doc.title,
    nodes,
    total,
    doneCount,
    percent,
    allDone: total > 0 && doneCount === total,
  };
}

import type { GraphEdge } from "./types";

/** 直接前置（默认只看硬依赖） */
export function prerequisites(
  edges: GraphEdge[],
  nodeId: string,
  kind: "hard" | "all" = "hard",
): string[] {
  return edges
    .filter((e) => e.to === nodeId && (kind === "all" || e.kind === "hard"))
    .map((e) => e.from);
}

/** 直接后继 */
export function dependents(edges: GraphEdge[], nodeId: string): string[] {
  return edges.filter((e) => e.from === nodeId).map((e) => e.to);
}

/** 传递后继数量：衡量「学它有多划算」 */
export function downstreamCount(edges: GraphEdge[], nodeId: string): number {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
    else adj.set(e.from, [e.to]);
  }
  const seen = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen.size;
}

/** 三色 DFS 找环；导入外部蓝图、连线前都要过这一关 */
export function detectCycle(edges: GraphEdge[], nodeIds?: string[]): boolean {
  const ids = nodeIds ?? Array.from(new Set(edges.flatMap((e) => [e.from, e.to])));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
    else adj.set(e.from, [e.to]);
  }
  const color = new Map<string, 0 | 1 | 2>();
  const dfs = (id: string): boolean => {
    color.set(id, 1);
    for (const next of adj.get(id) ?? []) {
      const c = color.get(next) ?? 0;
      if (c === 1) return true;
      if (c === 0 && dfs(next)) return true;
    }
    color.set(id, 2);
    return false;
  };
  return ids.some((id) => (color.get(id) ?? 0) === 0 && dfs(id));
}

export interface ConnectCheck {
  ok: boolean;
  reason?: string;
}

/** 连线合法性：自连 / 重复 / 成环，三件事一次挡掉 */
export function canConnect(
  edges: GraphEdge[],
  from: string,
  to: string,
): ConnectCheck {
  if (from === to) return { ok: false, reason: "不能连到自己" };
  if (edges.some((e) => e.from === from && e.to === to)) {
    return { ok: false, reason: "这条依赖已存在" };
  }
  const probe: GraphEdge = { id: "__probe__", from, to, kind: "hard" };
  if (detectCycle([...edges, probe])) {
    return { ok: false, reason: "会形成循环依赖" };
  }
  return { ok: true };
}

/** 拓扑序，导出与布局前做一次整体健全性检查 */
export function topoOrder(edges: GraphEdge[], nodeIds: string[]): string[] | null {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) indeg.set(id, 0);
  for (const e of edges) {
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue;
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    const list = adj.get(e.from);
    if (list) list.push(e.to);
    else adj.set(e.from, [e.to]);
  }
  const queue = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const out: string[] = [];
  while (queue.length) {
    const cur = queue.shift() as string;
    out.push(cur);
    for (const next of adj.get(cur) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  return out.length === nodeIds.length ? out : null;
}

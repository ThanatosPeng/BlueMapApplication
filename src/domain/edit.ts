import { canConnect } from "./graph";
import type { Blueprint, GraphEdge, GraphNode } from "./types";

export function addNode(doc: Blueprint, node: GraphNode): Blueprint {
  return { ...doc, nodes: [...doc.nodes, node] };
}

/** 删节点必须连带删边，否则会留下指向不存在节点的悬空依赖 */
export function removeNode(doc: Blueprint, nodeId: string): Blueprint {
  return {
    ...doc,
    nodes: doc.nodes.filter((n) => n.id !== nodeId),
    edges: doc.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
  };
}

export function updateNode(
  doc: Blueprint,
  nodeId: string,
  patch: Partial<Omit<GraphNode, "id">>,
): Blueprint {
  return {
    ...doc,
    nodes: doc.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
  };
}

export interface AddEdgeResult {
  doc: Blueprint;
  ok: boolean;
  reason?: string;
  edgeId?: string;
}

/** 连线前先过 canConnect：自连 / 重复 / 成环一次挡掉 */
export function addEdge(
  doc: Blueprint,
  from: string,
  to: string,
  idSeed = Date.now().toString(36),
): AddEdgeResult {
  const existing = new Set(doc.nodes.map((n) => n.id));
  if (!existing.has(from) || !existing.has(to)) {
    return { doc, ok: false, reason: "节点不存在" };
  }
  const check = canConnect(doc.edges, from, to);
  if (!check.ok) return { doc, ok: false, reason: check.reason };

  const edge: GraphEdge = { id: `${from}=>${to}#${idSeed}`, from, to, kind: "hard" };
  return { doc: { ...doc, edges: [...doc.edges, edge] }, ok: true, edgeId: edge.id };
}

export function removeEdge(doc: Blueprint, edgeId: string): Blueprint {
  return { ...doc, edges: doc.edges.filter((e) => e.id !== edgeId) };
}

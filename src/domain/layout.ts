import dagre from "@dagrejs/dagre";
import type { Blueprint, GraphNode } from "./types";

export interface NodeSize {
  w: number;
  h: number;
}

export function sizeOfNode(node: GraphNode, hasChild = false): NodeSize {
  if (node.type === "milestone") return { w: 214, h: hasChild ? 116 : 98 };
  return { w: 186, h: hasChild ? 104 : 86 };
}

export type PositionMap = Record<string, { x: number; y: number }>;

/**
 * 分层 DAG 自动布局（dagre）。返回的是 React Flow 需要的左上角坐标，
 * 而不是 dagre 原始的中心点坐标。
 */
export function layoutWithDagre(bp: Blueprint): PositionMap {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 92, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of bp.nodes) {
    const size = sizeOfNode(node);
    g.setNode(node.id, { width: size.w, height: size.h });
  }
  for (const edge of bp.edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const positions: PositionMap = {};
  for (const node of bp.nodes) {
    const p = g.node(node.id) as { x: number; y: number } | undefined;
    if (!p) continue;
    const size = sizeOfNode(node);
    positions[node.id] = { x: p.x - size.w / 2, y: p.y - size.h / 2 };
  }
  return positions;
}

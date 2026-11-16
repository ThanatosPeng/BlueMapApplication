import type { Blueprint } from "./types";

/** 跨蓝图关联：只表达「这两个节点相关」，不参与解锁计算 */
export interface CrossLink {
  id: string;
  fromBp: string;
  fromNode: string;
  toBp: string;
  /** 空字符串 = 指向整张蓝图（例如「这个节点被展开成了子蓝图」） */
  toNode: string;
  note?: string;
  /** 冗余标题：跨蓝图展示时不必再去查另一个库 */
  fromBpTitle?: string;
  fromTitle?: string;
  toBpTitle?: string;
  toTitle?: string;
}

export function makeLinkId(
  fromBp: string,
  fromNode: string,
  toBp: string,
  toNode: string,
): string {
  return `${fromBp}:${fromNode}=>${toBp}:${toNode}`;
}

export function nodeKey(bpId: string, nodeId: string): string {
  return `${bpId}:${nodeId}`;
}

/** 返回错误文案；null 表示合法。toNode 为空表示指向整张蓝图。 */
export function validateLink(
  link: Pick<CrossLink, "fromBp" | "fromNode" | "toBp" | "toNode">,
  blueprints: Map<string, Blueprint>,
): string | null {
  const from = blueprints.get(link.fromBp);
  const to = blueprints.get(link.toBp);
  if (!from || !to) return "蓝图不存在";
  if (link.toNode && link.fromBp === link.toBp && link.fromNode === link.toNode) {
    return "不能关联到自己";
  }
  if (!from.nodes.some((n) => n.id === link.fromNode)) return "起点节点不存在";
  if (link.toNode && !to.nodes.some((n) => n.id === link.toNode)) return "终点节点不存在";
  return null;
}

/**
 * 子蓝图对应的「父节点」关联（蓝图级，toNode 为空）。
 * 子蓝图顶部的「父蓝图节点」就是用它还原出来的。
 */
export function parentLinkFor(links: CrossLink[], bpId: string): CrossLink | null {
  return links.find((l) => l.toBp === bpId && !l.toNode) ?? null;
}

export function linksForNode(links: CrossLink[], bpId: string, nodeId: string) {
  return {
    outbound: links.filter((l) => l.fromBp === bpId && l.fromNode === nodeId),
    inbound: links.filter((l) => l.toBp === bpId && l.toNode === nodeId),
  };
}

/** 每个节点被多少条关联触达，用于画布上的小角标 */
export function linkCounts(links: CrossLink[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const link of links) {
    for (const key of [nodeKey(link.fromBp, link.fromNode), nodeKey(link.toBp, link.toNode)]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

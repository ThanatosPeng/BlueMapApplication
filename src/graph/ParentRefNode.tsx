import type { Node, NodeProps } from "@xyflow/react";

export interface ParentRefData extends Record<string, unknown> {
  title: string;
  bpTitle: string;
}

export type ParentRefNode = Node<ParentRefData, "parentRef">;

/**
 * 子蓝图顶部那个「父蓝图节点」：只读、不可拖，点一下回到父蓝图并选中它。
 * 它不是蓝图数据的一部分，是画布根据跨蓝图关联临时合成的。
 */
export function ParentRefNodeView({ data }: NodeProps<ParentRefNode>) {
  return (
    <div className="bm-node bm-node--parent" style={{ ["--accent" as string]: "#fbbf24" }}>
      <div className="bm-node__tag">父蓝图</div>
      <div className="bm-node__title">{data.title}</div>
      <div className="bm-node__sub">{data.bpTitle} · 点击返回</div>
    </div>
  );
}

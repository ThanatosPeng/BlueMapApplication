import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeStatus, NodeType } from "../domain/types";
import { STATE_COLOR, TYPE_COLOR } from "../ui/theme";

export interface BlueprintNodeData extends Record<string, unknown> {
  title: string;
  sub: string;
  type: NodeType;
  status: NodeStatus;
  mastery: number;
  hours?: number;
  /** 跨蓝图关联数量，>0 时右上角显示角标 */
  cross?: number;
  /** 非空 = 这是「容器节点」，卡片改为展示子蓝图进度 */
  child?: {
    title: string;
    total: number;
    doneCount: number;
    percent: number;
    preview: { title: string; mastery: number; done: boolean }[];
  } | null;
}

export type BlueprintFlowNode = Node<BlueprintNodeData, "blueprint">;

export function BlueprintNodeView({ data, selected }: NodeProps<BlueprintFlowNode>) {
  const accent = TYPE_COLOR[data.type] ?? "#60a5fa";
  const color = STATE_COLOR[data.status];
  const dots = Array.from({ length: 5 }, (_, i) => i < Math.round(data.mastery));

  return (
    <>
      {/* Handle 必须放在 .bm-node 外面：盒子里有 overflow:hidden，会把连接点裁掉一半导致拖不到 */}
      <Handle type="target" position={Position.Left} />
      <div
        className={[
          "bm-node",
          `is-${data.status}`,
          data.type === "milestone" ? "bm-node--milestone" : "",
          selected ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ ["--accent" as string]: accent }}
      >
        <div className="bm-node__title">{data.title}</div>
        {data.child ? (
          <div className="bm-node__child">
            <div className="bm-node__child-head">
              子蓝图 · {data.child.doneCount}/{data.child.total} 完成 · {data.child.percent}%
            </div>
            {data.child.preview.map((item) => (
              <div key={item.title} className="bm-node__child-row">
                <span className={item.done ? "is-done" : ""}>{item.done ? "✓" : "·"}</span>
                <span className="bm-node__child-title">{item.title}</span>
                <span className="bm-node__child-pct">{item.mastery}/5</span>
              </div>
            ))}
            <div className="bm-node__bar">
              <i style={{ width: `${data.child.percent}%` }} />
            </div>
          </div>
        ) : (
          <div className="bm-node__sub">{data.sub}</div>
        )}
        <div className="bm-node__meta" style={{ color }}>
          {dots.map((on, i) => (
            <span key={i} className={`bm-dot${on ? " on" : ""}`} />
          ))}
          {data.cross ? (
            <span
              title={`${data.cross} 条跨蓝图关联`}
              style={{ marginLeft: 2, fontSize: 10, color: "#7dd3fc" }}
            >
              ⇄{data.cross}
            </span>
          ) : null}
          {data.hours ? (
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#5f7191" }}>
              {data.hours}h
            </span>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

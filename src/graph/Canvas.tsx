import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { App as AntdApp, Button, Space, Typography } from "antd";
import { BlueprintNodeView } from "./BlueprintNode";
import { ParentRefNodeView } from "./ParentRefNode";
import { useAppStore } from "../store/useAppStore";
import { masteryOf, statusOf } from "../domain/mastery";
import { layoutWithDagre, sizeOfNode } from "../domain/layout";
import { canConnect } from "../domain/graph";
import { litIdsAt } from "../domain/timeline";
import { linkCounts, nodeKey, parentLinkFor } from "../domain/links";
import type { ChildSummary } from "../domain/childProgress";
import { STATE_COLOR } from "../ui/theme";
import { useIsNarrow } from "../ui/useIsNarrow";
import { TimelineBar } from "../features/TimelineBar";

const nodeTypes = { blueprint: BlueprintNodeView, parentRef: ParentRefNodeView };

export function Canvas() {
  const doc = useAppStore((s) => s.doc);
  const progress = useAppStore((s) => s.progress);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const moveNode = useAppStore((s) => s.moveNode);
  const setPositions = useAppStore((s) => s.setPositions);
  const addNode = useAppStore((s) => s.addNode);
  const deleteNode = useAppStore((s) => s.deleteNode);
  const connect = useAppStore((s) => s.connect);
  const syncSummary = useAppStore((s) => s.syncSummary);
  const focusNodeId = useAppStore((s) => s.focusNodeId);
  const setFocusNode = useAppStore((s) => s.setFocusNode);
  const replayAt = useAppStore((s) => s.replayAt);
  const links = useAppStore((s) => s.links);
  const jumpTo = useAppStore((s) => s.jumpTo);
  const crossCounts = useMemo(() => linkCounts(links), [links]);
  const childSummaries = useAppStore((s) => s.children);

  // 节点 → 它挂着的子蓝图汇总（父蓝图里的「容器节点」）
  const childForNode = useMemo(() => {
    const map: Record<string, ChildSummary> = {};
    if (!doc) return map;
    for (const link of links) {
      if (link.fromBp !== doc.id || link.toNode) continue;
      const summary = childSummaries[link.toBp];
      if (summary) map[link.fromNode] = summary;
    }
    return map;
  }, [links, childSummaries, doc]);

  // 当前是子蓝图时，把「父节点」合成到画布顶部
  const parentLink = useMemo(
    () => (doc ? parentLinkFor(links, doc.id) : null),
    [links, doc],
  );

  // 回放时：只显示「那个时刻已经点亮」的节点，其余压成未点亮
  const replayLit = useMemo(
    () => (replayAt == null ? null : litIdsAt(progress.nodes, replayAt)),
    [replayAt, progress.nodes],
  );

  const { message } = AntdApp.useApp();
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const narrow = useIsNarrow();

  const nodes = useMemo<Node<Record<string, unknown>>[]>(() => {
    if (!doc) return [];
    const real: Node<Record<string, unknown>>[] = doc.nodes.map((node) => {
      const hidden = replayLit ? !replayLit.has(node.id) : false;
      const status = hidden ? "locked" : statusOf(node.id, doc.edges, progress.nodes);
      const child = childForNode[node.id];
      const size = sizeOfNode(node, Boolean(child));
      return {
        id: node.id,
        type: "blueprint",
        position: progress.pos[node.id] ?? { x: node.tier * 280, y: node.row * 130 },
        selected: selectedId === node.id,
        width: size.w,
        height: size.h,
        data: {
          title: node.title,
          sub: node.sub,
          type: node.type,
          status,
          mastery: hidden ? 0 : masteryOf(progress.nodes, node.id),
          hours: node.hours,
          cross: crossCounts.get(nodeKey(doc.id, node.id)) ?? 0,
          child: child
            ? {
                title: child.title,
                total: child.total,
                doneCount: child.doneCount,
                percent: child.percent,
                preview: child.nodes.slice(0, 2).map((n) => ({
                  title: n.title,
                  mastery: n.mastery,
                  done: n.done,
                })),
              }
            : null,
        },
      } satisfies Node<Record<string, unknown>>;
    });

    if (!parentLink) return real;

    const minX = Math.min(...real.map((n) => n.position.x));
    const minY = Math.min(...real.map((n) => n.position.y));
    const ref: Node<Record<string, unknown>> = {
      id: "__parent__",
      type: "parentRef",
      position: { x: minX, y: minY - 132 },
      draggable: false,
      deletable: false,
      data: {
        title: parentLink.fromTitle ?? parentLink.fromNode,
        bpTitle: parentLink.fromBpTitle ?? parentLink.fromBp,
      },
    };
    return [ref, ...real];
  }, [doc, progress, selectedId, replayLit, crossCounts, parentLink, childForNode]);

  const edges = useMemo<Edge[]>(() => {
    if (!doc) return [];
    const focus = selectedId;
    const realEdges = doc.edges.map((edge) => {
      const litEdge = replayLit
        ? replayLit.has(edge.from) && replayLit.has(edge.to)
        : true;
      const fromMastered = masteryOf(progress.nodes, edge.from) >= 3 && litEdge;
      const adjacent = !!focus && (edge.from === focus || edge.to === focus);
      // 选中某节点时，只有与它相连的边保持高亮，其余压暗 —— 长跨层边就不会抢视线
      const dimmed = (!!focus && !adjacent) || !litEdge;
      const color = dimmed
        ? "rgba(60,78,108,0.55)"
        : fromMastered
          ? "rgba(251,191,36,0.62)"
          : "rgba(60,78,108,0.75)";
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: "default",
        animated: fromMastered && !dimmed,
        zIndex: adjacent ? 2 : 0,
        style: {
          stroke: color,
          strokeWidth: adjacent ? 2.1 : 1.6,
          opacity: dimmed ? 0.45 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color },
      };
    });

    if (!parentLink) return realEdges;
    // 从「父节点」拉虚线到每个子节点，表达「这些是从它拆出来的」
    const bridges: Edge[] = doc.nodes.map((node) => ({
      id: `__parent_edge__${node.id}`,
      source: "__parent__",
      target: node.id,
      type: "default",
      animated: false,
      zIndex: 1,
      style: {
        stroke: "rgba(251,191,36,0.35)",
        strokeWidth: 1.3,
        strokeDasharray: "5 5",
      },
    }));
    return [...realEdges, ...bridges];
  }, [doc, progress, selectedId, replayLit, parentLink]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.id === "__parent__" && parentLink) {
        void jumpTo(parentLink.fromBp, parentLink.fromNode);
        return;
      }
      select(node.id);
    },
    [select, parentLink, jumpTo],
  );

  // 搜索命中后由 header 触发：选中 + 把视口聚到该节点
  useEffect(() => {
    if (!focusNodeId) return;
    select(focusNodeId);
    flowRef.current?.fitView({
      nodes: [{ id: focusNodeId }] as Node[],
      padding: 2.4,
      duration: 420,
      maxZoom: 1.1,
    });
    setFocusNode(null);
  }, [focusNodeId, select, setFocusNode]);

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      moveNode(node.id, node.position.x, node.position.y);
      syncSummary();
    },
    [moveNode, syncSummary],
  );

  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      if (!doc) return false;
      if (!conn.source || !conn.target) return false;
      return canConnect(doc.edges, conn.source, conn.target).ok;
    },
    [doc],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const result = connect(conn.source, conn.target);
      if (result.ok) message.success("已建立依赖");
      else message.warning(result.reason ?? "这条依赖不合法");
    },
    [connect, message],
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) deleteNode(node.id);
    },
    [deleteNode],
  );

  const relayout = useCallback(() => {
    if (!doc) return;
    setPositions(layoutWithDagre(doc));
    flowRef.current?.fitView({ padding: 0.16, duration: 320 });
    syncSummary();
  }, [doc, setPositions, syncSummary]);

  const createNode = useCallback(() => {
    const center = flowRef.current?.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }) ?? { x: 120, y: 120 };
    const id = `n-${Date.now().toString(36)}`;
    addNode(
      {
        id,
        title: "新节点",
        sub: "在右侧编辑",
        type: "concept",
        tier: 0,
        row: 0,
        resources: [],
      },
      center,
    );
    message.info("已创建：拖到合适位置，再从右缘圆点拉线连依赖");
  }, [addNode, message]);

  if (!doc) return null;

  return (
    <div className="bm-canvas">
      {doc.nodes.length === 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, color: "#a9bbd4" }}>这张蓝图还是空的</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              点左上角「＋ 节点」建第一个，或选中节点后用 AI 拆解
            </div>
          </div>
        </div>
      ) : null}
      <ReactFlow
        key={doc.id}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={narrow ? undefined : onNodesDelete}
        onConnect={narrow ? undefined : onConnect}
        isValidConnection={isValidConnection}
        onPaneClick={() => select(null)}
        deleteKeyCode={narrow ? null : ["Delete", "Backspace"]}
        nodesDraggable={!narrow}
        nodesConnectable={!narrow}
        fitView={!narrow}
        defaultViewport={narrow ? { x: 18, y: 96, zoom: 0.72 } : undefined}
        fitViewOptions={{ padding: 0.08, maxZoom: 1.1, minZoom: 0.55 }}
        minZoom={0.3}
        maxZoom={1.8}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1}
          color="rgba(148,183,255,0.14)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(n) =>
            STATE_COLOR[((n.data?.status as keyof typeof STATE_COLOR) ?? "locked")] ?? "#4b5a74"
          }
          maskColor="rgba(7,13,24,0.62)"
          style={{
            width: 168,
            height: 108,
            background: "#0b1220",
            border: "1px solid rgba(120,160,220,0.16)",
            borderRadius: 10,
          }}
        />
        <Panel position="top-left">
          <Space size={8} align="center">
            {parentLink ? (
              <Button
                size="small"
                onClick={() => void jumpTo(parentLink.fromBp, parentLink.fromNode)}
              >
                ← {parentLink.fromBpTitle ?? "父蓝图"}
              </Button>
            ) : null}
            <Typography.Text strong style={{ fontSize: narrow ? 13 : 15 }}>
              {doc.title}
            </Typography.Text>
            {!narrow ? (
              <>
                <Button size="small" onClick={relayout}>
                  自动布局
                </Button>
                <Button size="small" onClick={createNode}>
                  ＋ 节点
                </Button>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  右缘圆点拉线建依赖 · 选中后 Delete 删除
                </Typography.Text>
              </>
            ) : null}
          </Space>
        </Panel>
      </ReactFlow>
      <TimelineBar />
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Button,
  Drawer,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useAppStore } from "../store/useAppStore";
import { masteryOf, statusOf } from "../domain/mastery";
import { MASTERY_HINT, MASTERY_LABEL } from "../domain/types";
import { STATE_COLOR, STATE_LABEL, TYPE_COLOR, TYPE_LABEL } from "../ui/theme";
import { useIsNarrow } from "../ui/useIsNarrow";
import { linksForNode } from "../domain/links";
import { childLinkForNode } from "../domain/childProgress";
import { QuizModal } from "./QuizModal";
import { ArtifactModal } from "./ArtifactModal";
import { CrossLinkModal } from "./CrossLinkModal";

export function Inspector() {
  const doc = useAppStore((s) => s.doc);
  const progress = useAppStore((s) => s.progress);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const setMastery = useAppStore((s) => s.setMastery);
  const setNote = useAppStore((s) => s.setNote);
  const reviewArtifact = useAppStore((s) => s.reviewArtifact);
  const artifactBusy = useAppStore((s) => s.artifactBusy);
  const artifactError = useAppStore((s) => s.artifactError);
  const syncSummary = useAppStore((s) => s.syncSummary);
  const expandNode = useAppStore((s) => s.expandNode);
  const ai = useAppStore((s) => s.ai);
  const updateNodeField = useAppStore((s) => s.updateNodeField);
  const narrow = useIsNarrow();
  const links = useAppStore((s) => s.links);
  const jumpTo = useAppStore((s) => s.jumpTo);
  const removeLink = useAppStore((s) => s.removeLink);
  const deleteNode = useAppStore((s) => s.deleteNode);
  const children = useAppStore((s) => s.children);
  const startQuiz = useAppStore((s) => s.startQuiz);
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const node = doc?.nodes.find((n) => n.id === selectedId) ?? null;

  if (!doc || !node) {
    return <Drawer open={false} onClose={() => select(null)} />;
  }

  const state = progress.nodes[node.id];
  const mastery = masteryOf(progress.nodes, node.id);
  const status = statusOf(node.id, doc.edges, progress.nodes);
  const prereqs = doc.edges.filter((e) => e.to === node.id).map((e) => e.from);
  const dependents = doc.edges.filter((e) => e.from === node.id).map((e) => e.to);
  const { outbound, inbound } = linksForNode(links, doc.id, node.id);
  const childLink = childLinkForNode(links, doc.id, node.id);
  const childSummary = childLink ? children[childLink.toBp] : null;
  const nodeState = progress.nodes[node.id];

  const changeMastery = (value: number) => {
    setMastery(node.id, value);
    syncSummary();
  };

  return (
    <Drawer
      open
      styles={{
        wrapper: {
          top: 60,
          height: "calc(100% - 60px)",
          width: narrow ? "100%" : 410,
        },
        body: { padding: narrow ? 14 : 24 },
      }}
      onClose={() => select(null)}
      title={
        <Space size={6} wrap>
          <Tag color={TYPE_COLOR[node.type]} style={{ marginInlineEnd: 0 }}>
            {TYPE_LABEL[node.type]}
          </Tag>
          <Tag color={STATE_COLOR[status]} style={{ marginInlineEnd: 0 }}>
            {STATE_LABEL[status]}
          </Tag>
          {node.hours ? <Tag style={{ marginInlineEnd: 0 }}>{node.hours}h</Tag> : null}
        </Space>
      }
    >
      <Typography.Title
        level={4}
        style={{ marginTop: 0, marginBottom: 4 }}
        editable={
          narrow
            ? false
            : {
                tooltip: "点击改标题",
                onChange: (value) => {
                  const next = value.trim();
                  if (next) updateNodeField(node.id, { title: next });
                },
              }
        }
      >
        {node.title}
      </Typography.Title>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 12 }}
        editable={
          narrow
            ? false
            : {
                tooltip: "点击改说明",
                onChange: (value) => updateNodeField(node.id, { sub: value.trim() }),
              }
        }
      >
        {node.sub || "（未填写说明）"}
      </Typography.Text>

      {!narrow ? (
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: "#7d90ab", marginBottom: 4 }}>
            类型
          </div>
          <Select
            size="small"
            value={node.type}
            style={{ width: "100%" }}
            onChange={(value) => updateNodeField(node.id, { type: value })}
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div style={{ width: 96 }}>
          <div style={{ fontSize: 10, letterSpacing: 0.6, color: "#7d90ab", marginBottom: 4 }}>
            预计工时
          </div>
          <InputNumber
            size="small"
            min={0}
            max={999}
            value={node.hours}
            style={{ width: "100%" }}
            onChange={(value) =>
              updateNodeField(node.id, { hours: typeof value === "number" ? value : undefined })
            }
          />
        </div>
      </div>
      ) : null}

      {childSummary ? (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 11,
            background: "rgba(56,189,248,0.06)",
            border: "1px solid rgba(56,189,248,0.18)",
          }}
        >
          <div style={{ fontSize: 11, color: "#7dd3fc", marginBottom: 6 }}>
            容器节点 · {childSummary.doneCount}/{childSummary.total} 完成 · 总进度{" "}
            {childSummary.percent}%
          </div>
          {childSummary.nodes.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11.5,
                padding: "3px 0",
              }}
            >
              <span style={{ color: item.done ? "#fbbf24" : "#5f7191" }}>
                {item.done ? "✓" : "·"}
              </span>
              <span style={{ flex: 1 }}>{item.title}</span>
              <span style={{ color: "#5f7191", fontSize: 10.5 }}>{item.mastery}/5</span>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 6 }}>
            掌握度由子蓝图自动结算；全部点亮后本节点自动完成。
          </div>
          <Button
            size="small"
            block
            style={{ marginTop: 8 }}
            onClick={() => void jumpTo(childLink!.toBp, "")}
          >
            打开子蓝图
          </Button>
        </div>
      ) : null}
      {node.desc ? (
        <div
          style={{
            marginTop: 14,
            padding: "11px 12px",
            borderRadius: 11,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
            fontSize: 12.5,
            lineHeight: 1.75,
            color: "#b9c8de",
          }}
        >
          {node.desc}
        </div>
      ) : null}

      {/* 容器节点（挂了子蓝图）不显示掌握度与证据：它的"内容"就是那张子图 */}
      {!childSummary ? (
        <>
      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
        掌握度
      </div>
      {narrow ? (
        <Select
          value={mastery}
          style={{ width: "100%" }}
          onChange={(value) => changeMastery(Number(value))}
          options={MASTERY_LABEL.map((label, value) => ({
            value,
            label: `${value} · ${label}`,
          }))}
        />
      ) : (
        <Segmented
          block
          value={mastery}
          onChange={(v) => changeMastery(Number(v))}
          options={MASTERY_LABEL.map((label, value) => ({
            value,
            label: (
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                <span style={{ fontWeight: 600 }}>{value}</span>
                <span style={{ fontSize: 9.5 }}>{label}</span>
              </div>
            ),
          }))}
        />
      )}
      <div style={{ marginTop: 8, fontSize: 10.5, color: "#64748b", lineHeight: 1.6 }}>
        {MASTERY_HINT[mastery] ?? ""}
      </div>
        </>
      ) : null}

      {!childSummary ? (
        <>
          <Space size={8} style={{ marginTop: 12, marginBottom: 4 }} wrap>
            <Button size="small" onClick={() => void startQuiz(node.id)}>
              AI 问答
            </Button>
            <Button size="small" onClick={() => setArtifactOpen(true)}>
              关联作品 / 仓库
            </Button>
          </Space>

          {artifactError ? (
            <div style={{ marginTop: 8, fontSize: 11.5, color: "#fda4af" }}>{artifactError}</div>
          ) : null}

          {(nodeState?.artifacts ?? []).length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {(nodeState?.artifacts ?? []).map((item, index) => (
                <div key={`${item.ref}-${index}`} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                    <span style={{ color: "#7dd3fc" }}>{item.kind === "repo" ? "⌥" : "▤"}</span>
                    <span
                      style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={item.ref}
                    >
                      {item.label ?? item.ref}
                    </span>
                    {item.review ? (
                      <span style={{ color: "#fbbf24", fontSize: 10.5 }}>AI {item.review.score}/5</span>
                    ) : null}
                    <Button
                      size="small"
                      type="text"
                      loading={artifactBusy === `${node.id}:${index}`}
                      onClick={() => void reviewArtifact(node.id, index)}
                    >
                      评估
                    </Button>
                  </div>
                  {item.review ? (
                    <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.6, marginTop: 2 }}>
                      {item.review.summary}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {nodeState?.aiQuiz ? (
            <div style={{ marginTop: 10, fontSize: 11.5, color: "#a9bbd4" }}>
              <div>
                AI 问答 {nodeState.aiQuiz.score}/5 · {nodeState.aiQuiz.summary}
              </div>
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: "pointer", fontSize: 10.5, color: "#7d90ab" }}>
                  查看问答记录（{nodeState.aiQuiz.qa.length} 题，本地已保存）
                </summary>
                {nodeState.aiQuiz.qa.map((item, index) => (
                  <div key={index} style={{ marginTop: 6, fontSize: 11 }}>
                    <div style={{ color: "#c7d4e6" }}>
                      Q{index + 1}. {item.q}
                    </div>
                    <div style={{ color: "#7d90ab" }}>A: {item.a || "（未作答）"}</div>
                  </div>
                ))}
              </details>
            </div>
          ) : null}
        </>
      ) : null}

      <QuizModal />
      <ArtifactModal nodeId={node.id} open={artifactOpen} onClose={() => setArtifactOpen(false)} />
      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
        跨蓝图关联
      </div>
      {outbound.length + inbound.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {outbound.map((link) => (
            <div
              key={link.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <span
                onClick={() => void jumpTo(link.toBp, link.toNode)}
                style={{ flex: 1, cursor: "pointer", fontSize: 11.5, color: "#a9d8f5" }}
              >
                {link.toNode
                  ? `→ ${link.toBpTitle ?? link.toBp} · ${link.toTitle ?? link.toNode}`
                  : `→ 子蓝图 · ${link.toBpTitle ?? link.toBp}`}
              </span>
              <Button size="small" type="text" onClick={() => void removeLink(link.id)}>
                ✕
              </Button>
            </div>
          ))}
          {inbound.map((link) => (
            <div
              key={link.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <span
                onClick={() => void jumpTo(link.fromBp, link.fromNode)}
                style={{ flex: 1, cursor: "pointer", fontSize: 11.5, color: "#a9bbd4" }}
              >
                ← {link.fromBpTitle ?? link.fromBp} · {link.fromTitle ?? link.fromNode}
              </span>
              <Button size="small" type="text" onClick={() => void removeLink(link.id)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
          还没有跨蓝图关联。关联只是提示，不影响解锁。
        </div>
      )}
      <Button block onClick={() => setLinkOpen(true)}>
        关联到其他蓝图
      </Button>
      <CrossLinkModal open={linkOpen} onClose={() => setLinkOpen(false)} />

      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
        AI 辅助
      </div>
      <Button block disabled={!ai.key} onClick={() => void expandNode(node.id)}>
        AI 拆成子节点
      </Button>
      <div style={{ marginTop: 6, fontSize: 10.5, color: "#64748b" }}>
        {ai.key ? "生成后先预览，勾选才写库" : "配置 DeepSeek Key 后可用"}
      </div>

      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
        笔记
      </div>
      <Input.TextArea
        value={state?.note ?? ""}
        onChange={(e) => setNote(node.id, e.target.value)}
        autoSize={{ minRows: 4, maxRows: 10 }}
        placeholder="用自己的话写一遍。写不出来，说明还没真懂。"
      />

      <div style={{ marginTop: 20, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
        依赖关系
      </div>
      <Space size={4} wrap>
        {prereqs.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            无前置，可直接开始
          </Typography.Text>
        ) : (
          prereqs.map((id) => {
            const target = doc.nodes.find((n) => n.id === id);
            if (!target) return null;
            const st = statusOf(id, doc.edges, progress.nodes);
            return (
              <Tag key={id} color={STATE_COLOR[st]} style={{ cursor: "pointer" }} onClick={() => select(id)}>
                {target.title}
              </Tag>
            );
          })
        )}
      </Space>
      <div style={{ marginTop: 8 }}>
        {dependents.length > 0 ? (
          <Space size={4} wrap>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              解锁后 →
            </Typography.Text>
            {dependents.map((id) => {
              const target = doc.nodes.find((n) => n.id === id);
              if (!target) return null;
              return (
                <Tag key={id} style={{ cursor: "pointer" }} onClick={() => select(id)}>
                  {target.title}
                </Tag>
              );
            })}
          </Space>
        ) : null}
      </div>

      {node.resources.length > 0 ? (
        <>
          <div style={{ marginTop: 20, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
            资源
          </div>
          {node.resources.map((res) => (
            <div key={res.label} style={{ marginBottom: 4 }}>
              <Typography.Link href={res.url || "#"} target="_blank" style={{ fontSize: 12.5 }}>
                {res.label}
              </Typography.Link>
            </div>
          ))}
        </>
      ) : null}

      {!narrow ? (
        <>
          <div
            style={{ marginTop: 24, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}
          >
            危险操作
          </div>
          <Popconfirm
            title="删除这个节点？"
            description={
              prereqs.length + dependents.length > 0
                ? `会同时断开 ${prereqs.length + dependents.length} 条依赖，可用撤销恢复`
                : "可用撤销恢复"
            }
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void deleteNode(node.id)}
          >
            <Button danger block>
              删除节点
            </Button>
          </Popconfirm>
        </>
      ) : null}
    </Drawer>
  );
}

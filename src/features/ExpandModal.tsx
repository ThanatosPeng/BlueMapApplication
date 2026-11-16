import { useEffect, useState } from "react";
import { Alert, App as AntdApp, Button, Checkbox, Empty, Modal, Spin, Tag, Typography } from "antd";
import { useAppStore } from "../store/useAppStore";

/**
 * AI 拆节点预览：生成结果先落「预览态」，逐条勾选后才写库。
 * 采纳时每个子节点都会连到父节点下面（见 store.adoptDrafts）。
 */
export function ExpandModal() {
  const expand = useAppStore((s) => s.expand);
  const doc = useAppStore((s) => s.doc);
  const createChildBlueprint = useAppStore((s) => s.createChildBlueprint);
  const cancelExpand = useAppStore((s) => s.cancelExpand);
  const { message } = AntdApp.useApp();

  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    setChecked((expand?.drafts ?? []).map(() => true));
  }, [expand]);

  const parent = doc?.nodes.find((n) => n.id === expand?.nodeId) ?? null;
  const picked = (expand?.drafts ?? []).filter((_, i) => checked[i]);

  const toggle = (index: number) => {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  return (
    <Modal
      open={!!expand}
      title={parent ? `拆解「${parent.title}」` : "拆解节点"}
      onCancel={cancelExpand}
      width={560}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={cancelExpand}>取消</Button>
          <Button
            type="primary"
            disabled={picked.length === 0}
            onClick={() => {
              if (!expand) return;
              const count = picked.length;
              void createChildBlueprint(expand.nodeId, picked).then((id) => {
                if (id) message.success(`已生成子蓝图（${count} 个节点），并关联到当前节点`);
              });
            }}
          >
            采纳 {picked.length} 个
          </Button>
        </div>
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
        勾选的草稿会生成一张子蓝图，并从当前节点连一条跨蓝图关联；原蓝图本身不会变长。
      </Typography.Paragraph>

      {expand?.busy ? (
        <div style={{ padding: "36px 0", textAlign: "center" }}>
          <Spin />
          <div style={{ marginTop: 12, fontSize: 12, color: "#7d90ab" }}>DeepSeek 正在拆解…</div>
        </div>
      ) : expand?.error ? (
        <Alert type="warning" showIcon message={expand.error} />
      ) : (expand?.drafts.length ?? 0) === 0 ? (
        <Empty description="没有生成结果" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expand?.drafts.map((draft, index) => (
            <label
              key={`${draft.title}-${index}`}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 10,
                cursor: "pointer",
                background: checked[index] ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${checked[index] ? "rgba(56,189,248,0.28)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <Checkbox checked={!!checked[index]} onChange={() => toggle(index)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#e6eefb" }}>{draft.title}</div>
                {draft.sub ? (
                  <div style={{ fontSize: 11, color: "#8497b2", marginTop: 2 }}>{draft.sub}</div>
                ) : null}
              </div>
              {draft.hours ? <Tag style={{ marginInlineEnd: 0 }}>{draft.hours}h</Tag> : null}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

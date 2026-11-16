import { useEffect, useState } from "react";
import { Button, Input, Modal, Select, Typography } from "antd";
import { useAppStore } from "../store/useAppStore";

export function CrossLinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = useAppStore((s) => s.list);
  const doc = useAppStore((s) => s.doc);
  const selectedId = useAppStore((s) => s.selectedId);
  const fetchNodes = useAppStore((s) => s.fetchNodes);
  const addLink = useAppStore((s) => s.addLink);

  const [bp, setBp] = useState<string>();
  const [node, setNode] = useState<string>();
  const [note, setNote] = useState("");
  const [nodes, setNodes] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBp(undefined);
    setNode(undefined);
    setNote("");
    setNodes([]);
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!bp) {
      setNodes([]);
      return;
    }
    void fetchNodes(bp).then(setNodes);
  }, [bp, fetchNodes]);

  const source = doc?.nodes.find((n) => n.id === selectedId);

  const submit = async () => {
    if (!bp || !node) {
      setError("请选择要关联的蓝图和节点");
      return;
    }
    setBusy(true);
    const result = await addLink(bp, node, note.trim() || undefined);
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.reason ?? "关联失败");
  };

  return (
    <Modal
      open={open}
      title="关联到其他蓝图"
      okText="建立关联"
      cancelText="取消"
      confirmLoading={busy}
      onOk={() => void submit()}
      onCancel={onClose}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
        跨蓝图关联只是「这两个节点相关」的提示，不参与解锁计算。
        {source ? ` 起点：「${source.title}」` : ""}
      </Typography.Paragraph>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>目标蓝图</div>
        <Select
          value={bp}
          placeholder="选一张蓝图"
          style={{ width: "100%" }}
          onChange={(value) => {
            setBp(value);
            setNode(undefined);
          }}
          options={list.filter((b) => b.id !== doc?.id).map((b) => ({ value: b.id, label: b.title }))}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>目标节点</div>
        <Select
          value={node}
          placeholder={bp ? "选一个节点" : "先选蓝图"}
          disabled={!bp}
          showSearch
          optionFilterProp="label"
          style={{ width: "100%" }}
          onChange={setNode}
          options={nodes.map((n) => ({ value: n.id, label: n.title }))}
        />
      </div>

      <div>
        <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>备注（可选）</div>
        <Input
          value={note}
          placeholder="例如：这里的指针基础直接决定 TS 的类型收窄理解"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error ? (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#fda4af" }}>{error}</div>
      ) : null}

      <div style={{ marginTop: 14, textAlign: "right" }}>
        <Button size="small" type="text" onClick={onClose}>
          关闭
        </Button>
      </div>
    </Modal>
  );
}

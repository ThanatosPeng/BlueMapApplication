import { useState } from "react";
import { Input, Modal, Segmented, Typography } from "antd";
import { useAppStore } from "../store/useAppStore";

/**
 * 关联作品 / 仓库：本地路径或在线仓库链接。
 * 「让 AI 读内容分析」留了入口但本期不实现（见 DESIGN §5.11）。
 */
export function ArtifactModal({
  nodeId,
  open,
  onClose,
}: {
  nodeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const attachArtifact = useAppStore((s) => s.attachArtifact);
  const [kind, setKind] = useState<"local" | "repo">("repo");
  const [ref, setRef] = useState("");
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");

  const submit = () => {
    const value = ref.trim();
    if (!value) return;
    attachArtifact(nodeId, {
      kind,
      ref: value,
      label: label.trim() || undefined,
      content: content.trim() || undefined,
      at: Date.now(),
    });
    setRef("");
    setLabel("");
    setContent("");
    onClose();
  };

  return (
    <Modal
      open={open}
      title="关联作品 / 代码仓库"
      okText="关联"
      cancelText="取消"
      onOk={submit}
      onCancel={onClose}
      okButtonProps={{ disabled: ref.trim().length === 0 }}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
        关联一个能证明「我真做出来了」的产出：本地项目路径，或 GitHub / Gitee 仓库链接。
        本期只做关联与展示，AI 读取内容分析留给下一步。
      </Typography.Paragraph>

      <Segmented
        block
        value={kind}
        onChange={(value) => setKind(value as "local" | "repo")}
        options={[
          { value: "repo", label: "在线仓库" },
          { value: "local", label: "本地路径" },
        ]}
        style={{ marginBottom: 12 }}
      />

      <Input
        value={ref}
        onChange={(event) => setRef(event.target.value)}
        placeholder={
          kind === "repo" ? "https://github.com/you/project" : "D:\\projects\\my-firmware"
        }
        style={{ marginBottom: 10 }}
      />

      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="一句话说明它证明了什么（可选）"
        style={{ marginBottom: 10 }}
      />

      <Typography.Paragraph type="secondary" style={{ fontSize: 10.5, marginBottom: 4 }}>
        贴上 README 摘要或关键代码，AI 才能真的"读"到它；不贴就只能凭描述判断。
      </Typography.Paragraph>
      <Input.TextArea
        rows={5}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="例如：README 的核心段落，或 30 行关键实现"
      />
    </Modal>
  );
}

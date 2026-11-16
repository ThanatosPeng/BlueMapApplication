import { useState } from "react";
import { Button, Input, Modal, Typography } from "antd";
import { useAppStore } from "../store/useAppStore";
import { DEFAULT_AI, type AIConfig } from "../ai/provider";

export function AICoach() {
  const ai = useAppStore((s) => s.ai);
  const busy = useAppStore((s) => s.aiBusy);
  const result = useAppStore((s) => s.aiResult);
  const error = useAppStore((s) => s.aiError);
  const runAI = useAppStore((s) => s.runAI);
  const saveAI = useAppStore((s) => s.saveAI);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AIConfig>(ai);

  const configured = Boolean(ai.key);

  const openSettings = () => {
    setDraft(ai);
    setOpen(true);
  };

  return (
    <div className="bm-card">
      <div className="bm-card__head">
        <span>AI 教练</span>
        <span
          style={{
            marginLeft: "auto",
            letterSpacing: 0,
            fontSize: 10,
            color: configured ? "#34d399" : "#6d7f99",
          }}
        >
          {configured ? "DeepSeek 已配置" : "未配置"}
        </span>
      </div>

      {!configured ? (
        <>
          <Typography.Text type="secondary" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
            填入 DeepSeek Key 后，可让模型基于你的图谱给一轮建议。不填也能用——下方推荐是本地规则算的。
          </Typography.Text>
          <Button block style={{ marginTop: 10 }} onClick={openSettings}>
            配置 DeepSeek
          </Button>
        </>
      ) : (
        <>
          <Button block type="primary" loading={busy} onClick={() => void runAI()}>
            {busy ? "分析中…" : "让 DeepSeek 分析这张图"}
          </Button>
          <Button block type="text" size="small" style={{ marginTop: 4 }} onClick={openSettings}>
            修改配置
          </Button>
        </>
      )}

      {error ? (
        <div
          style={{
            marginTop: 10,
            padding: "9px 10px",
            borderRadius: 9,
            background: "rgba(244,63,94,0.08)",
            border: "1px solid rgba(244,63,94,0.25)",
            color: "#fda4af",
            fontSize: 11.5,
            lineHeight: 1.7,
          }}
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <div
          style={{
            marginTop: 10,
            padding: "10px 11px",
            borderRadius: 9,
            background: "rgba(56,189,248,0.05)",
            border: "1px solid rgba(56,189,248,0.16)",
            fontSize: 12,
            lineHeight: 1.85,
            color: "#cfdcee",
            whiteSpace: "pre-wrap",
          }}
        >
          {result}
        </div>
      ) : null}

      <Modal
        open={open}
        title="AI 接入 · DeepSeek"
        okText="保存"
        cancelText="取消"
        onOk={() => {
          void saveAI(draft).then(() => setOpen(false));
        }}
        onCancel={() => setOpen(false)}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
          Key 只保存在本机 IndexedDB，不会上传。请求经 `/api/deepseek` 代理转发，避免浏览器 CORS。
        </Typography.Paragraph>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>BASE URL</div>
          <Input
            value={draft.baseURL}
            placeholder={DEFAULT_AI.baseURL}
            onChange={(e) => setDraft({ ...draft, baseURL: e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>模型</div>
          <Input
            value={draft.model}
            placeholder={DEFAULT_AI.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>API KEY</div>
          <Input.Password
            value={draft.key}
            placeholder="sk-..."
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}

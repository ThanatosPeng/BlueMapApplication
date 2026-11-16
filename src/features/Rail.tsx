import { Button, Progress, Typography } from "antd";
import { AICoach } from "./AICoach";
import { useAppStore } from "../store/useAppStore";
import { suggest } from "../domain/recommend";
import { levelOf, masteryOf, xpOf } from "../domain/mastery";
import { dueNodes } from "../domain/scheduler";

export function Rail() {
  const doc = useAppStore((s) => s.doc);
  const progress = useAppStore((s) => s.progress);
  const select = useAppStore((s) => s.select);
  const setReviewOpen = useAppStore((s) => s.setReviewOpen);
  const storageLabel = useAppStore((s) => s.storageLabel);
  const savedAt = useAppStore((s) => s.savedAt);
  const saveError = useAppStore((s) => s.saveError);

  if (!doc) return null;

  const total = doc.nodes.length;
  const mastered = doc.nodes.filter((n) => masteryOf(progress.nodes, n.id) >= 4).length;
  const learning = doc.nodes.filter((n) => {
    const m = masteryOf(progress.nodes, n.id);
    return m > 0 && m < 4;
  }).length;
  const xp = xpOf(doc.nodes, progress.nodes);
  const level = levelOf(xp);
  const recs = suggest(doc, progress.nodes, 3);
  const due = dueNodes(progress.nodes).filter((id) => masteryOf(progress.nodes, id) >= 4);

  return (
    <div className="bm-rail">
      <div className="bm-card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Progress
          type="circle"
          size={78}
          percent={total ? Math.round((mastered / total) * 100) : 0}
          strokeColor={{ "0%": "#38bdf8", "100%": "#fbbf24" }}
        />
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong style={{ fontSize: 15, display: "block" }}>
            {doc.title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.5 }}>
            目标 · {doc.goal}
          </Typography.Text>
          <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4 }}>
            已掌握 {mastered} / {total} · 学习中 {learning}
          </div>
        </div>
      </div>

      <div className="bm-card">
        <div className="bm-card__head">
          <span>今日推荐</span>
          <span style={{ marginLeft: "auto", color: "#7dd3fc", letterSpacing: 0 }}>
            可解释排序
          </span>
        </div>
        {recs.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            暂时没有可学节点，先点亮一个前置吧。
          </Typography.Text>
        ) : (
          recs.map((rec, i) => (
            <div key={rec.nodeId} className="bm-rec" onClick={() => select(rec.nodeId)}>
              <span className="bm-rec__rank">{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="bm-rec__title">{rec.title}</div>
                <div className="bm-rec__why">{rec.reason}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bm-card">
        <div className="bm-card__head">
          <span>复习队列</span>
          <span style={{ marginLeft: "auto", color: "#fbbf24", letterSpacing: 0 }}>
            {due.length}
          </span>
        </div>
        {due.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            今天没有到期的节点，专注学新的。
          </Typography.Text>
        ) : (
          <Button block type="primary" onClick={() => setReviewOpen(true)}>
            开始复习 {due.length} 张
          </Button>
        )}
      </div>

      <AICoach />

      <div style={{ marginTop: "auto", fontSize: 10.5, color: "#4b5a74" }}>
        {xp} XP · Lv.{level.level} · 数据：{storageLabel}
        {saveError ? " · 保存失败" : savedAt ? ` · 已保存 ${new Date(savedAt).toLocaleTimeString("zh-CN", { hour12: false })}` : ""}
      </div>
    </div>
  );
}

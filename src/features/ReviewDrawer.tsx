import { useEffect, useMemo, useState } from "react";
import { Button, Drawer, Empty, Progress, Space, Tag, Typography } from "antd";
import { useAppStore } from "../store/useAppStore";
import { masteryOf } from "../domain/mastery";
import { dueNodes, type ReviewResult } from "../domain/scheduler";
import { STATE_COLOR, TYPE_COLOR, TYPE_LABEL } from "../ui/theme";

export function ReviewDrawer() {
  const doc = useAppStore((s) => s.doc);
  const progress = useAppStore((s) => s.progress);
  const open = useAppStore((s) => s.reviewOpen);
  const setOpen = useAppStore((s) => s.setReviewOpen);
  const review = useAppStore((s) => s.review);

  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0 });

  // 队列只在「打开那一刻」定格，避免答完一张后列表突然缩短
  const queue = useMemo(() => {
    if (!open) return [];
    return dueNodes(progress.nodes).filter((id) => masteryOf(progress.nodes, id) >= 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setStats({ again: 0, hard: 0, good: 0 });
    }
  }, [open]);

  const node = doc?.nodes.find((n) => n.id === queue[index]) ?? null;
  const done = open && index >= queue.length;

  const answer = (result: ReviewResult) => {
    if (!node) return;
    review(node.id, result);
    setStats((s) => ({ ...s, [result]: s[result] + 1 }));
    setIndex((i) => i + 1);
  };

  const total = stats.again + stats.hard + stats.good;
  const retention = total ? Math.round(((stats.hard + stats.good) / total) * 100) : 0;

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      size={460}
      styles={{ wrapper: { top: 60, height: "calc(100% - 60px)" } }}
      title={queue.length ? `复习 · ${Math.min(index + 1, queue.length)} / ${queue.length}` : "复习"}
    >
      {!doc || queue.length === 0 ? (
        <Empty description="今天没有到期的节点，专注学新的。" />
      ) : done ? (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <Progress
            type="circle"
            percent={retention}
            strokeColor={{ "0%": "#f472b6", "100%": "#fbbf24" }}
          />
          <Typography.Title level={5} style={{ marginTop: 18 }}>
            本轮复习完成
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            记住 {stats.good} · 模糊 {stats.hard} · 忘记 {stats.again}
          </Typography.Text>
          <div style={{ marginTop: 22 }}>
            <Button type="primary" onClick={() => setOpen(false)}>
              收工
            </Button>
          </div>
        </div>
      ) : node ? (
        <>
          <Space size={6} wrap style={{ marginBottom: 10 }}>
            <Tag color={TYPE_COLOR[node.type]} style={{ marginInlineEnd: 0 }}>
              {TYPE_LABEL[node.type]}
            </Tag>
            <Tag style={{ marginInlineEnd: 0 }}>{masteryOf(progress.nodes, node.id)}/5</Tag>
            <Tag color={STATE_COLOR.review} style={{ marginInlineEnd: 0 }}>
              已到期
            </Tag>
          </Space>
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>
            {node.title}
          </Typography.Title>
          <div
            style={{
              padding: "12px 13px",
              borderRadius: 11,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 12.5,
              lineHeight: 1.75,
              color: "#b9c8de",
              marginBottom: 18,
            }}
          >
            {node.desc || node.sub}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            先合上资料，用自己的话讲一遍，再选一个：
          </Typography.Text>
          <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 12 }}>
            <Button block danger onClick={() => answer("again")}>
              想不起来（明天再来）
            </Button>
            <Button block onClick={() => answer("hard")}>
              有点模糊（缩短间隔）
            </Button>
            <Button block type="primary" onClick={() => answer("good")}>
              讲清楚了（拉长间隔）
            </Button>
          </Space>
        </>
      ) : null}
    </Drawer>
  );
}

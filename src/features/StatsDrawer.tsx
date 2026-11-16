import { useMemo } from "react";
import { Col, Drawer, Empty, Progress, Row, Statistic, Tag, Typography } from "antd";
import { useAppStore } from "../store/useAppStore";
import { computeStats } from "../domain/stats";
import { evaluateAchievements, unlockedCount } from "../domain/achievements";

const BUCKET_COLOR: Record<string, string> = {
  mastered: "#fbbf24",
  learning: "#f59e0b",
  available: "#38bdf8",
  locked: "#4b5a74",
};

export function StatsDrawer() {
  const open = useAppStore((s) => s.statsOpen);
  const setOpen = useAppStore((s) => s.setStatsOpen);
  const doc = useAppStore((s) => s.doc);
  const progress = useAppStore((s) => s.progress);
  const select = useAppStore((s) => s.select);
  const setFocusNode = useAppStore((s) => s.setFocusNode);

  const stats = useMemo(
    () => (doc ? computeStats(doc, progress.nodes) : null),
    [doc, progress.nodes],
  );

  const badges = useMemo(
    () => (doc ? evaluateAchievements(doc, progress.nodes) : []),
    [doc, progress.nodes],
  );

  const jump = (nodeId: string) => {
    select(nodeId);
    setFocusNode(nodeId);
    setOpen(false);
  };

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title="复盘"
      size={420}
      styles={{ wrapper: { top: 60, height: "calc(100% - 60px)" } }}
    >
      {!stats || !doc ? (
        <Empty description="还没有数据" />
      ) : (
        <>
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Statistic title="已掌握" value={stats.mastered} suffix={`/ ${stats.total}`} />
            </Col>
            <Col span={12}>
              <Statistic
                title="近 7 天点亮"
                value={stats.weeklyLit}
                valueStyle={{ color: "#fbbf24" }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="复习到期"
                value={stats.due}
                valueStyle={{ color: stats.due ? "#f472b6" : undefined }}
                suffix={stats.overdueDays > 0 ? `逾期 ${stats.overdueDays} 天` : undefined}
              />
            </Col>
            <Col span={12}>
              <Statistic title="剩余工时" value={Math.round(stats.hoursLeft)} suffix="h" />
            </Col>
          </Row>

          <div style={{ marginTop: 26, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
            状态分布 · 平均掌握度 {stats.avgMastery} / 5
          </div>
          {(
            [
              ["mastered", "已掌握", stats.mastered],
              ["learning", "学习中", stats.learning],
              ["available", "可学", stats.available],
              ["locked", "锁定", stats.locked],
            ] as const
          ).map(([key, label, count]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", fontSize: 11.5, color: "#a9bbd4", marginBottom: 3 }}>
                <span>{label}</span>
                <span style={{ marginLeft: "auto" }}>{count}</span>
              </div>
              <Progress
                percent={stats.total ? Math.round((count / stats.total) * 100) : 0}
                showInfo={false}
                size={{ height: 6 }}
                strokeColor={BUCKET_COLOR[key]}
              />
            </div>
          ))}

          {stats.bottlenecks.length > 0 ? (
            <>
              <div style={{ marginTop: 22, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
                卡住的节点
              </div>
              <Typography.Paragraph type="secondary" style={{ fontSize: 11, lineHeight: 1.7 }}>
                有进度、但下游影响最大。优先推它们，收益最高。
              </Typography.Paragraph>
              {stats.bottlenecks.map((item) => (
                <div
                  key={item.nodeId}
                  onClick={() => jump(item.nodeId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 9,
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.02)",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "#dbe6f7" }}>{item.title}</span>
                  <Tag style={{ marginLeft: "auto", marginInlineEnd: 0 }}>{item.mastery}/5</Tag>
                  <span style={{ fontSize: 10.5, color: "#64748b" }}>下游 {item.leverage}</span>
                </div>
              ))}
            </>
          ) : null}

          <div style={{ marginTop: 22, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
            按层进度
          </div>
          {stats.byTier.map((tier) => (
            <div key={tier.tier} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#8497b2", width: 42 }}>第 {tier.tier} 层</span>
              <Progress
                percent={Math.round((tier.mastered / tier.total) * 100)}
                showInfo={false}
                size={{ height: 5 }}
                strokeColor={{ "0%": "#38bdf8", "100%": "#fbbf24" }}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10.5, color: "#64748b", width: 44, textAlign: "right" }}>
                {tier.mastered}/{tier.total}
              </span>
            </div>
          ))}

          <div style={{ marginTop: 22, marginBottom: 8, fontSize: 10.5, letterSpacing: 1, color: "#7d90ab" }}>
            成就 · {unlockedCount(badges)} / {badges.length}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {badges.map((badge) => (
              <div
                key={badge.id}
                style={{
                  borderRadius: 10,
                  padding: "8px 10px",
                  border: `1px solid ${badge.unlocked ? "rgba(251,191,36,0.45)" : "rgba(255,255,255,0.06)"}`,
                  background: badge.unlocked
                    ? "rgba(251,191,36,0.08)"
                    : "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: badge.unlocked ? "#fbbf24" : "#a9bbd4",
                  }}
                >
                  {badge.unlocked ? "★ " : ""}
                  {badge.title}
                </div>
                <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2, lineHeight: 1.5 }}>
                  {badge.unlocked ? badge.desc : `${badge.current}/${badge.target} · ${badge.desc}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

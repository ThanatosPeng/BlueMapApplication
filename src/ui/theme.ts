import { theme, type ThemeConfig } from "antd";

export const blueMapTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#38bdf8",
    colorBgBase: "#070d18",
    colorBgContainer: "#111a2b",
    colorBgElevated: "#111a2b",
    colorBorder: "rgba(120,160,220,0.16)",
    borderRadius: 12,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Layout: {
      headerBg: "rgba(10,16,28,0.82)",
      siderBg: "rgba(9,14,24,0.55)",
      bodyBg: "#070d18",
      headerHeight: 60,
      headerPadding: "0 18px",
    },
    Drawer: { colorBgElevated: "#0b1220" },
    Modal: { contentBg: "#111a2b" },
    Segmented: { itemSelectedBg: "rgba(56,189,248,0.16)" },
  },
};

/** 节点状态色：只用于 Tag / 进度等表现层，不劫持 antd 的语义色 */
export const STATE_COLOR = {
  locked: "#4b5a74",
  available: "#38bdf8",
  learning: "#f59e0b",
  mastered: "#fbbf24",
  review: "#f472b6",
} as const;

export const TYPE_COLOR = {
  concept: "#60a5fa",
  skill: "#34d399",
  practice: "#a78bfa",
  project: "#fb923c",
  milestone: "#fbbf24",
  resource: "#94a3b8",
  checkpoint: "#f472b6",
} as const;

export const TYPE_LABEL = {
  concept: "概念",
  skill: "技能",
  practice: "练习",
  project: "项目",
  milestone: "里程碑",
  resource: "资源",
  checkpoint: "检查点",
} as const;

export const STATE_LABEL = {
  locked: "锁定",
  available: "可学",
  learning: "学习中",
  mastered: "已掌握",
  review: "待复习",
} as const;

export type NodeType =
  | "concept"
  | "skill"
  | "practice"
  | "project"
  | "milestone"
  | "resource"
  | "checkpoint";

export type NodeStatus = "locked" | "available" | "learning" | "mastered" | "review";

export type EdgeKind = "hard" | "soft";

export interface Resource {
  label: string;
  url?: string;
}

export interface GraphNode {
  id: string;
  title: string;
  sub: string;
  type: NodeType;
  desc?: string;
  hours?: number;
  /** 布局层级与行号：仅用于首次 dagre 不可用时的兜底坐标 */
  tier: number;
  row: number;
  resources: Resource[];
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface Blueprint {
  id: string;
  title: string;
  goal: string;
  /** 子蓝图挂在父蓝图下；空 = 顶层蓝图 */
  parentId?: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Evidence {
  self: boolean;
  quiz: boolean;
  artifact: boolean;
  ai: boolean;
}

/** 关联的作品：本地路径，或在线仓库链接 */
export interface ArtifactRef {
  kind: "local" | "repo";
  /** 本地路径或 URL */
  ref: string;
  label?: string;
  at: number;
  /** 交给 AI 分析的内容（README 摘要 / 关键代码），不给就只能人工判断 */
  content?: string;
  /** AI 对这份作品的评估结果 */
  review?: {
    score: number;
    summary: string;
    at: number;
  } | null;
}

/** AI 问答的结果：分数 + 点评 + 原始问答，便于回看 */
export interface AIQuizResult {
  /** 0-5 */
  score: number;
  summary: string;
  at: number;
  qa: { q: string; a: string }[];
}

export interface NodeState {
  /** 0 未知 / 1 接触 / 2 理解 / 3 应用 / 4 迁移 / 5 教学 */
  mastery: number;
  note: string;
  dueAt: number | null;
  intervalDays: number;
  evidence: Evidence;
  /** 最近一次「点亮」（mastery 达到 4）的时间戳；掉回 4 级以下会清空 */
  litAt?: number | null;
  /** 由子蓝图全部完成而自动点亮（手动改掌握度会清掉） */
  autoCompleted?: boolean;
  artifacts?: ArtifactRef[];
  aiQuiz?: AIQuizResult | null;
}

export interface ProgressDoc {
  nodes: Record<string, NodeState>;
  pos: Record<string, { x: number; y: number }>;
}

export const MASTERY_LABEL = ["未知", "接触", "理解", "应用", "迁移", "教学"] as const;

export const MASTERY_HINT = [
  "还没开始。点「开始学习」把它变成学习中。",
  "看过、听过，但还说不清。先补一个最小可运行例子。",
  "能用自己的话解释核心概念了，但还不会动手。",
  "能在给定场景下独立做对。到 4 级才算真正点亮。",
  "换个新场景、新项目仍然能用 —— 这才是节点该有的终点。",
  "能讲给别人听并回答追问。可以把这条经验写成笔记。",
] as const;

export function emptyNodeState(mastery = 0, dueIn: number | null = null): NodeState {
  return {
    mastery,
    note: "",
    dueAt: dueIn == null ? null : Date.now() + dueIn * 86400000,
    intervalDays: dueIn ?? 0,
    evidence: { self: false, quiz: false, artifact: false, ai: false },
    litAt: null,
  };
}

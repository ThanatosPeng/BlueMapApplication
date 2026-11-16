import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import { createRepo, type Repo } from "../persist/repo";
import {
  emptyNodeState,
  type Blueprint,
  type Evidence,
  type GraphNode,
  type NodeState,
  type ProgressDoc,
} from "../domain/types";
import { applyReview, scheduleAfterLight, type ReviewResult } from "../domain/scheduler";
import { masteryOf } from "../domain/mastery";
import {
  addEdge,
  addNode as addNodePure,
  removeNode,
  updateNode as patchNode,
} from "../domain/edit";
import { buildBundle, parseBundle } from "../domain/serialize";
import { layoutWithDagre } from "../domain/layout";
import {
  buildLearningPrompt,
  DEFAULT_AI,
  describeAIError,
  type AIConfig,
} from "../ai/provider";
import { createDeepSeek } from "../ai/deepseek";
import { buildExpandPrompt, parseDrafts, type NodeDraft } from "../ai/expand";
import { buildGradePrompt, buildQuizPrompt, parseGrade, parseQuiz } from "../ai/quiz";
import { timelineRange } from "../domain/timeline";
import { summarizeChild, type ChildSummary } from "../domain/childProgress";
import { makeLinkId, validateLink, type CrossLink } from "../domain/links";
import type { AIQuizResult, ArtifactRef } from "../domain/types";
import { buildArtifactPrompt, parseArtifactReview } from "../ai/artifactReview";

/**
 * 掌握度只由两类证据决定：
 * - AI 问答的分数；
 * - 每个关联作品的 AI 评估分数（多个取平均）。
 * 两者都有时取较小值（最保守），都没有才保留手动值。
 */
function combineScores(
  quizScore: number | undefined,
  artifacts: ArtifactRef[] | undefined,
  fallback: number,
): number {
  const scores: number[] = [];
  if (typeof quizScore === "number") scores.push(quizScore);

  const reviews = (artifacts ?? [])
    .map((a) => a.review?.score)
    .filter((s): s is number => typeof s === "number");
  if (reviews.length > 0) {
    scores.push(reviews.reduce((sum, s) => sum + s, 0) / reviews.length);
  }

  if (scores.length === 0) return fallback;
  return Math.max(0, Math.min(5, Math.round(Math.min(...scores))));
}

export interface ExpandState {
  nodeId: string;
  drafts: NodeDraft[];
  busy: boolean;
  error: string | null;
}

export interface QuizState {
  nodeId: string;
  questions: string[];
  busy: boolean;
  grading: boolean;
  error: string | null;
  score: number | null;
  summary: string | null;
}

export interface BlueprintSummary {
  id: string;
  title: string;
  goal: string;
  parentId?: string | null;
  total: number;
  mastered: number;
}

export interface AppState {
  ready: boolean;
  error: string | null;
  persistent: boolean;
  /** 数据存哪儿，直接显示给用户，避免"以为存了其实没存" */
  storageLabel: string;
  /** 最近一次成功保存的时间戳 */
  savedAt: number | null;
  saveError: string | null;
  /** 桌面端的数据文件绝对路径（诊断用） */
  storagePath: string | null;
  /** 当前蓝图里各节点挂着的子蓝图汇总（key = 子蓝图 id） */
  children: Record<string, ChildSummary>;
  /** 跨蓝图关联是否已从存储加载过（初始化顺序敏感，见 open） */
  linksLoaded: boolean;
  attachArtifact: (nodeId: string, artifact: ArtifactRef) => void;
  reviewArtifact: (nodeId: string, index: number) => Promise<void>;
  removeArtifact: (nodeId: string, index: number) => void;
  applyQuiz: (nodeId: string, result: AIQuizResult) => void;
  refreshChildren: () => Promise<void>;
  artifactBusy: string | null;
  artifactError: string | null;
  quiz: QuizState | null;
  startQuiz: (nodeId: string) => Promise<void>;
  finishQuiz: (nodeId: string, qa: { q: string; a: string }[]) => Promise<void>;
  cancelQuiz: () => void;
  list: BlueprintSummary[];
  activeId: string | null;
  doc: Blueprint | null;
  progress: ProgressDoc;
  selectedId: string | null;

  init: () => Promise<void>;
  open: (id: string) => Promise<void>;
  select: (id: string | null) => void;
  setMastery: (nodeId: string, value: number) => void;
  setNote: (nodeId: string, note: string) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  setPositions: (pos: Record<string, { x: number; y: number }>) => void;
  addNode: (node: GraphNode, pos: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => Promise<void>;
  connect: (from: string, to: string) => { ok: boolean; reason?: string };
  updateNodeField: (
    nodeId: string,
    patch: Partial<Pick<GraphNode, "title" | "sub" | "hours" | "type">>,
  ) => void;
  review: (nodeId: string, result: ReviewResult) => void;
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  ai: AIConfig;
  aiBusy: boolean;
  aiResult: string | null;
  aiError: string | null;
  loadAI: () => Promise<void>;
  saveAI: (config: AIConfig) => Promise<void>;
  runAI: () => Promise<void>;
  exportAll: () => Promise<string>;
  importAll: (text: string) => Promise<{ ok: boolean; reason?: string }>;
  refreshList: () => Promise<void>;
  createBlueprint: (title: string, goal: string) => Promise<string>;
  deleteBlueprint: (id: string) => Promise<void>;
  focusNodeId: string | null;
  setFocusNode: (id: string | null) => void;
  relayout: () => void;
  addNodeFree: () => void;
  expand: ExpandState | null;
  expandNode: (nodeId: string) => Promise<void>;
  /** 把草稿变成一张子蓝图，并从父节点连一条跨蓝图关联 */
  createChildBlueprint: (nodeId: string, drafts: NodeDraft[]) => Promise<string>;
  cancelExpand: () => void;
  statsOpen: boolean;
  setStatsOpen: (open: boolean) => void;
  timelineOpen: boolean;
  replayAt: number | null;
  openTimeline: () => void;
  closeTimeline: () => void;
  setReplayAt: (at: number | null) => void;
  links: CrossLink[];
  loadLinks: () => Promise<void>;
  addLink: (
    toBp: string,
    toNode: string,
    note?: string,
  ) => Promise<{ ok: boolean; reason?: string }>;
  removeLink: (id: string) => Promise<void>;
  jumpTo: (bpId: string, nodeId: string) => Promise<void>;
  fetchNodes: (bpId: string) => Promise<{ id: string; title: string }[]>;
  syncSummary: () => void;
}

const EMPTY_PROGRESS: ProgressDoc = { nodes: {}, pos: {} };

let repo: Repo | null = null;

function ensureNodeState(progress: ProgressDoc, nodeId: string): NodeState {
  const existing = progress.nodes[nodeId];
  if (existing) return existing;
  const created = emptyNodeState();
  progress.nodes[nodeId] = created;
  return created;
}

/** 读出当前蓝图里每个节点挂着的子蓝图（文档 + 进度），用于节点卡片和自动完成 */
async function loadChildren(
  doc: Blueprint,
  links: CrossLink[],
): Promise<Record<string, ChildSummary>> {
  const result: Record<string, ChildSummary> = {};
  if (!repo) return result;

  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  for (const link of links) {
    if (link.fromBp !== doc.id || link.toNode || !nodeIds.has(link.fromNode)) continue;
    const childDoc = await repo.getBlueprint(link.toBp);
    if (!childDoc) continue;
    const childProgress = (await repo.getProgress(link.toBp)) ?? { nodes: {}, pos: {} };
    result[link.toBp] = summarizeChild(
      link.toBp,
      childDoc,
      childProgress,
      link.toBpTitle ?? childDoc.title,
    );
  }
  return result;
}

/** 子蓝图全部完成 → 父节点自动点亮（只升不降） */
function applyAutoCompletion(doc: Blueprint, children: Record<string, ChildSummary>): void {
  const { links } = useAppStore.getState();
  for (const link of links) {
    if (link.fromBp !== doc.id || link.toNode) continue;
    if (!children[link.toBp]?.allDone) continue;
    const current = useAppStore.getState().progress.nodes[link.fromNode];
    if (!current || current.mastery >= 4) continue;

    useAppStore.setState((s) => {
      const target = s.progress.nodes[link.fromNode];
      if (!target || target.mastery >= 4) return;
      target.mastery = 4;
      target.autoCompleted = true;
      target.litAt = Date.now();
      Object.assign(target, scheduleAfterLight(target));
    });
  }
}
export const useAppStore = create<AppState>()(
  temporal(
    immer((set, get) => ({
      ready: false,
      error: null,
      persistent: true,
  storageLabel: "初始化中",
  savedAt: null,
  saveError: null,
  storagePath: null,
  children: {},
  linksLoaded: false,
  artifactBusy: null,
  artifactError: null,
  quiz: null,
      list: [],
      activeId: null,
      doc: null,
      progress: EMPTY_PROGRESS,
      selectedId: null,
      reviewOpen: false,
      focusNodeId: null,
      expand: null,
      statsOpen: false,
      timelineOpen: false,
      replayAt: null,
      ai: DEFAULT_AI,
      aiBusy: false,
      aiResult: null,
      aiError: null,

      init: async () => {
        try {
          repo = await createRepo();
          const docs = await repo.listBlueprints();
          const list: BlueprintSummary[] = [];
          for (const doc of docs) {
            const progress = (await repo.getProgress(doc.id)) ?? EMPTY_PROGRESS;
            list.push({
              id: doc.id,
              title: doc.title,
              goal: doc.goal,
              parentId: doc.parentId ?? null,
              total: doc.nodes.length,
              mastered: doc.nodes.filter((n) => masteryOf(progress.nodes, n.id) >= 4).length,
            });
          }
          const info = await window.bluemap?.store?.info?.().catch(() => null);
          set({
            list,
            ready: list.length > 0,
            persistent: repo.persistent,
            storageLabel: repo.label,
            storagePath: info?.file ?? null,
            error: null,
          });
          // 支持 ?bp=<id> 深链，默认打开第一张
          const wanted = new URLSearchParams(window.location.search).get("bp");
          const target = list.find((b) => b.id === wanted) ?? list[0];
          // 先加载跨蓝图关联，再打开蓝图：否则首屏会把「容器节点」当普通节点渲染
          await get().loadLinks();
          if (target) await get().open(target.id);
          await get().loadAI();

          // ?node=<id> 深链：打开某节点详情
          const wantedNode = new URLSearchParams(window.location.search).get("node");
          if (wantedNode && get().doc?.nodes.some((n) => n.id === wantedNode)) {
            set({ selectedId: wantedNode });
          }
        } catch (err) {
          console.error("[bluemap] init failed", err);
          set({
            ready: false,
            error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          });
        }
      },

      open: async (id) => {
        if (!repo) return;
        const doc = await repo.getBlueprint(id);
        if (!doc) return;
        const progress = (await repo.getProgress(id)) ?? EMPTY_PROGRESS;
        for (const node of doc.nodes) ensureNodeState(progress, node.id);

        // 首屏 open 可能早于 loadLinks：先补齐，否则「容器节点」会被当成普通节点渲染
        if (!get().linksLoaded) {
          const links = (await repo.listLinks()) ?? [];
          set({ links, linksLoaded: true });
        }

        const children = await loadChildren(doc, get().links);
        set({ activeId: id, doc, progress, selectedId: null, children });
        useAppStore.temporal.getState().clear();

        // 子蓝图全部完成 → 父节点自动点亮
        applyAutoCompletion(doc, children);
      },

      refreshChildren: async () => {
        const { doc, links } = get();
        if (!doc) return;
        const children = await loadChildren(doc, links);
        set({ children });
        applyAutoCompletion(doc, children);
      },

      startQuiz: async (nodeId) => {
        const { doc, ai } = get();
        const node = doc?.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        if (!ai.key) {
          set({
            quiz: {
              nodeId,
              questions: [],
              busy: false,
              grading: false,
              error: "还没有配置 DeepSeek Key，先去「配置 DeepSeek」填上",
              score: null,
              summary: null,
            },
          });
          return;
        }

        set({
          quiz: { nodeId, questions: [], busy: true, grading: false, error: null, score: null, summary: null },
        });

        try {
          const text = await createDeepSeek(ai).suggest(buildQuizPrompt(node));
          const questions = parseQuiz(text);
          set((s) => {
            if (!s.quiz) return;
            s.quiz.questions = questions;
            s.quiz.busy = false;
            if (questions.length === 0) s.quiz.error = "AI 没返回可用的问题，重试一次";
          });
        } catch (err) {
          set((s) => {
            if (!s.quiz) return;
            s.quiz.busy = false;
            s.quiz.error = describeAIError(err);
          });
        }
      },

      finishQuiz: async (nodeId, qa) => {
        const { doc, ai } = get();
        const node = doc?.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        set((s) => {
          if (s.quiz) s.quiz.grading = true;
        });

        try {
          const text = await createDeepSeek(ai).suggest(buildGradePrompt(node, qa));
          const grade = parseGrade(text);
          get().applyQuiz(nodeId, {
            score: grade.score,
            summary: grade.summary,
            at: Date.now(),
            qa,
          });
          set((s) => {
            if (!s.quiz) return;
            s.quiz.grading = false;
            s.quiz.score = grade.score;
            s.quiz.summary = grade.summary;
          });
        } catch (err) {
          set((s) => {
            if (!s.quiz) return;
            s.quiz.grading = false;
            s.quiz.error = describeAIError(err);
          });
        }
      },

      cancelQuiz: () => set({ quiz: null }),
      reviewArtifact: async (nodeId, index) => {
        const { doc, ai, progress } = get();
        const node = doc?.nodes.find((n) => n.id === nodeId);
        const artifact = progress.nodes[nodeId]?.artifacts?.[index];
        if (!node || !artifact) return;

        if (!ai.key) {
          set({ artifactError: "先配置 DeepSeek Key，才能让 AI 评估作品" });
          return;
        }

        set({ artifactBusy: `${nodeId}:${index}`, artifactError: null });
        try {
          const text = await createDeepSeek(ai).suggest(buildArtifactPrompt(node, artifact));
          const review = parseArtifactReview(text);
          set((s) => {
            const state = s.progress.nodes[nodeId];
            const target = state?.artifacts?.[index];
            if (!state || !target) return;
            target.review = { ...review, at: Date.now() };
            state.mastery = combineScores(state.aiQuiz?.score, state.artifacts, state.mastery);
            if (state.mastery >= 4 && !state.litAt) {
              state.litAt = Date.now();
              Object.assign(state, scheduleAfterLight(state));
            }
          });
        } catch (err) {
          set({ artifactError: describeAIError(err) });
        } finally {
          set({ artifactBusy: null });
        }
      },
      attachArtifact: (nodeId, artifact) =>
        set((s) => {
          const state = ensureNodeState(s.progress, nodeId);
          const next = [...(state.artifacts ?? []), artifact];
          state.artifacts = next;
          state.mastery = combineScores(state.aiQuiz?.score, next, state.mastery);
        }),

      removeArtifact: (nodeId, index) =>
        set((s) => {
          const state = ensureNodeState(s.progress, nodeId);
          const next = (state.artifacts ?? []).filter((_, i) => i !== index);
          state.artifacts = next;
          state.mastery = combineScores(state.aiQuiz?.score, next, state.mastery);
        }),

      applyQuiz: (nodeId, result) =>
        set((s) => {
          const state = ensureNodeState(s.progress, nodeId);
          state.aiQuiz = result;
          // 掌握度只由「AI 问答」与「作品评估」决定，见 recomputeMastery
          state.mastery = combineScores(state.aiQuiz?.score, state.artifacts, state.mastery);
          if (state.mastery >= 4 && !state.litAt) {
            state.litAt = Date.now();
            Object.assign(state, scheduleAfterLight(state));
          }
        }),

      select: (id) => set({ selectedId: id }),

      setMastery: (nodeId, value) =>
        set((s) => {
          const state = ensureNodeState(s.progress, nodeId);
          const before = state.mastery;
          state.mastery = Math.max(0, Math.min(5, value));
          // 手动改过就以人为准，取消自动点亮的标记
          state.autoCompleted = false;
          if (state.mastery >= 4 && before < 4) {
            Object.assign(state, scheduleAfterLight(state));
            state.litAt = Date.now();
          }
          if (state.mastery < 4) state.litAt = null;
          if (state.mastery === 0) state.dueAt = null;
        }),

      setNote: (nodeId, note) =>
        set((s) => {
          ensureNodeState(s.progress, nodeId).note = note;
        }),


      moveNode: (nodeId, x, y) =>
        set((s) => {
          s.progress.pos[nodeId] = { x, y };
        }),

      setPositions: (pos) =>
        set((s) => {
          s.progress.pos = pos;
        }),

      addNode: (node, pos) =>
        set((s) => {
          if (!s.doc) return;
          s.doc = addNodePure(s.doc, node);
          s.progress.nodes[node.id] = emptyNodeState();
          s.progress.pos[node.id] = pos;
          s.selectedId = node.id;
        }),

      deleteNode: async (nodeId) => {
        const { doc, links } = get();
        if (!doc) return;

        // 跨蓝图关联也要一起清掉，否则会留下指向不存在节点的悬空引用
        const dangling = links.filter(
          (l) =>
            (l.fromBp === doc.id && l.fromNode === nodeId) ||
            (l.toBp === doc.id && l.toNode === nodeId),
        );

        set((s) => {
          if (!s.doc) return;
          s.doc = removeNode(s.doc, nodeId);
          delete s.progress.nodes[nodeId];
          delete s.progress.pos[nodeId];
          if (s.selectedId === nodeId) s.selectedId = null;
        });

        if (dangling.length > 0) {
          const dead = new Set(dangling.map((l) => l.id));
          set({ links: links.filter((l) => !dead.has(l.id)) });
          await Promise.all(dangling.map((l) => repo?.deleteLink(l.id)));
        }
      },

      connect: (from, to) => {
        const { doc } = get();
        if (!doc) return { ok: false, reason: "蓝图未加载" };
        const result = addEdge(doc, from, to);
        if (!result.ok) return { ok: false, reason: result.reason };
        set({ doc: result.doc });
        return { ok: true };
      },

      updateNodeField: (nodeId, patch) =>
        set((s) => {
          if (!s.doc) return;
          s.doc = patchNode(s.doc, nodeId, patch);
        }),

      review: (nodeId, result) =>
        set((s) => {
          const state = ensureNodeState(s.progress, nodeId);
          s.progress.nodes[nodeId] = applyReview(state, result);
        }),

      setReviewOpen: (open) => set({ reviewOpen: open }),

      loadAI: async () => {
        const stored = (await repo?.getSetting<AIConfig>("ai")) ?? null;
        set({ ai: { ...DEFAULT_AI, ...(stored ?? {}) } });
      },

      saveAI: async (config) => {
        set({ ai: config, aiError: null, aiResult: null });
        await repo?.setSetting("ai", config);
      },

      runAI: async () => {
        const { doc, progress, ai } = get();
        if (!doc) return;
        set({ aiBusy: true, aiError: null, aiResult: null });
        try {
          const provider = createDeepSeek(ai);
          const text = await provider.suggest(buildLearningPrompt(doc, progress.nodes));
          set({ aiResult: text, aiBusy: false });
        } catch (err) {
          set({ aiError: describeAIError(err), aiBusy: false });
        }
      },

      exportAll: async () => {
        if (!repo) return "{}";
        const docs = await repo.listBlueprints();
        const items = [];
        for (const doc of docs) {
          const progress = (await repo.getProgress(doc.id)) ?? { nodes: {}, pos: {} };
          items.push({ doc, progress });
        }
        return JSON.stringify(buildBundle(items), null, 2);
      },

      importAll: async (text) => {
        if (!repo) return { ok: false, reason: "存储尚未就绪" };
        const parsed = parseBundle(text);
        if (!parsed.ok) return { ok: false, reason: parsed.reason };

        for (const item of parsed.bundle.blueprints) {
          await repo.saveBlueprint(item.doc.id, item.doc);
          await repo.saveProgress(item.doc.id, item.progress);
        }

        const docs = await repo.listBlueprints();
        const list: BlueprintSummary[] = [];
        for (const doc of docs) {
          const progress = (await repo.getProgress(doc.id)) ?? EMPTY_PROGRESS;
          list.push({
            id: doc.id,
            title: doc.title,
            goal: doc.goal,
            parentId: doc.parentId ?? null,
            total: doc.nodes.length,
            mastered: doc.nodes.filter((n) => masteryOf(progress.nodes, n.id) >= 4).length,
          });
        }
        set({ list, ready: true });

        const first = parsed.bundle.blueprints[0];
        if (first) await get().open(first.doc.id);
        return { ok: true };
      },

      refreshList: async () => {
        if (!repo) return;
        const docs = await repo.listBlueprints();
        const list: BlueprintSummary[] = [];
        for (const doc of docs) {
          const p = (await repo.getProgress(doc.id)) ?? EMPTY_PROGRESS;
          list.push({
            id: doc.id,
            title: doc.title,
            goal: doc.goal,
            parentId: doc.parentId ?? null,
            total: doc.nodes.length,
            mastered: doc.nodes.filter((n) => masteryOf(p.nodes, n.id) >= 4).length,
          });
        }
        set({ list, ready: true });
      },

      createBlueprint: async (title, goal) => {
        if (!repo) return "";
        const id = `bp-${Date.now().toString(36)}`;
        const doc: Blueprint = {
          id,
          title: title.trim() || "未命名蓝图",
          goal: goal.trim(),
          nodes: [],
          edges: [],
        };
        await repo.saveBlueprint(id, doc);
        await repo.saveProgress(id, { nodes: {}, pos: {} });
        await get().refreshList();
        await get().open(id);
        return id;
      },

      deleteBlueprint: async (id) => {
        if (!repo) return;
        await repo.deleteBlueprint(id);
        await get().refreshList();
        if (get().activeId === id) {
          const next = get().list[0];
          if (next) await get().open(next.id);
          else set({ activeId: null, doc: null, progress: EMPTY_PROGRESS, selectedId: null });
        }
      },

      setFocusNode: (id) => set({ focusNodeId: id }),

      relayout: () =>
        set((s) => {
          if (!s.doc) return;
          s.progress.pos = layoutWithDagre(s.doc);
        }),

      addNodeFree: () => {
        const { doc, progress, addNode } = get();
        if (!doc) return;
        const xs = Object.values(progress.pos).map((p) => p.x);
        const maxX = xs.length ? Math.max(...xs) : 0;
        addNode(
          {
            id: `n-${Date.now().toString(36)}`,
            title: "新节点",
            sub: "在右侧编辑",
            type: "concept",
            tier: 0,
            row: 0,
            resources: [],
          },
          { x: maxX + 240, y: 120 },
        );
      },

      expandNode: async (nodeId) => {
        const { doc, ai } = get();
        const node = doc?.nodes.find((n) => n.id === nodeId);
        if (!doc || !node) return;

        set({ expand: { nodeId, drafts: [], busy: true, error: null } });
        try {
          const provider = createDeepSeek(ai);
          const text = await provider.suggest(buildExpandPrompt(node, doc));
          const parsed = parseDrafts(text);
          if (!parsed.ok) {
            set({ expand: { nodeId, drafts: [], busy: false, error: parsed.reason } });
            return;
          }
          set({ expand: { nodeId, drafts: parsed.drafts, busy: false, error: null } });
        } catch (err) {
          set({ expand: { nodeId, drafts: [], busy: false, error: describeAIError(err) } });
        }
      },

      createChildBlueprint: async (nodeId, drafts) => {
        if (!repo) return "";
        const { doc } = get();
        if (!doc) return "";
        const parent = doc.nodes.find((n) => n.id === nodeId);
        if (!parent || drafts.length === 0) return "";

        const id = `bp-${Date.now().toString(36)}`;
        const nodes: GraphNode[] = drafts.map((d, i) => ({
          id: `${id}-n${i}`,
          title: d.title,
          sub: d.sub,
          type: "concept",
          tier: 0,
          row: i,
          hours: d.hours,
          resources: [],
        }));

        const child: Blueprint = {
          id,
          title: parent.title,
          goal: `从「${parent.title}」拆出来的子蓝图`,
          parentId: doc.id,
          nodes,
          edges: [],
        };
        const childProgress: ProgressDoc = {
          nodes: Object.fromEntries(nodes.map((n) => [n.id, emptyNodeState()])),
          pos: Object.fromEntries(nodes.map((n, i) => [n.id, { x: 80 + i * 240, y: 80 }])),
        };

        await repo.saveBlueprint(id, child);
        await repo.saveProgress(id, childProgress);

        const link: CrossLink = {
          id: makeLinkId(doc.id, nodeId, id, ""),
          fromBp: doc.id,
          fromNode: nodeId,
          toBp: id,
          toNode: "",
          note: `AI 拆解出 ${drafts.length} 个节点`,
          fromBpTitle: doc.title,
          fromTitle: parent.title,
          toBpTitle: child.title,
        };
        set({ links: [...get().links, link] });
        await repo.saveLink(link);

        await get().refreshList();
        await get().open(id);
        set({ expand: null });
        return id;
      },
      cancelExpand: () => set({ expand: null }),

      setStatsOpen: (open) => set({ statsOpen: open }),

      openTimeline: () => {
        const range = timelineRange(get().progress.nodes);
        set({ timelineOpen: true, replayAt: range ? range.start : null });
      },
      closeTimeline: () => set({ timelineOpen: false, replayAt: null }),
      setReplayAt: (at) => set({ replayAt: at }),

      links: [],

      loadLinks: async () => {
        const links = (await repo?.listLinks()) ?? [];
        set({ links, linksLoaded: true });
        // 关联变了（或被延迟加载），当前蓝图里的容器节点要重算
        if (get().doc) await get().refreshChildren();
      },

      addLink: async (toBp, toNode, note) => {
        const { doc, selectedId, links } = get();
        if (!repo) return { ok: false, reason: "存储尚未就绪" };
        if (!doc || !selectedId) return { ok: false, reason: "先选中一个节点" };

        const target = await repo.getBlueprint(toBp);
        if (!target) return { ok: false, reason: "目标蓝图不存在" };

        const candidate: CrossLink = {
          id: makeLinkId(doc.id, selectedId, toBp, toNode),
          fromBp: doc.id,
          fromNode: selectedId,
          toBp,
          toNode,
          note,
          fromBpTitle: doc.title,
          fromTitle: doc.nodes.find((n) => n.id === selectedId)?.title,
          toBpTitle: target.title,
          toTitle: target.nodes.find((n) => n.id === toNode)?.title,
        };
        const error = validateLink(
          candidate,
          new Map([
            [doc.id, doc],
            [toBp, target],
          ]),
        );
        if (error) return { ok: false, reason: error };
        if (links.some((l) => l.id === candidate.id)) {
          return { ok: false, reason: "这条关联已存在" };
        }

        set({ links: [...links, candidate] });
        await repo.saveLink(candidate);
        return { ok: true };
      },

      removeLink: async (id) => {
        set({ links: get().links.filter((l) => l.id !== id) });
        await repo?.deleteLink(id);
      },

      jumpTo: async (bpId, nodeId) => {
        if (get().activeId !== bpId) await get().open(bpId);
        if (nodeId) set({ selectedId: nodeId, focusNodeId: nodeId });
      },

      fetchNodes: async (bpId) => {
        const bp = await repo?.getBlueprint(bpId);
        return (bp?.nodes ?? []).map((n) => ({ id: n.id, title: n.title }));
      },

      syncSummary: () =>
        set((s) => {
          if (!s.doc || !s.activeId) return;
          const item = s.list.find((b) => b.id === s.activeId);
          if (item) {
            item.mastered = s.doc.nodes.filter(
              (n) => masteryOf(s.progress.nodes, n.id) >= 4,
            ).length;
          }
        }),
    })),
    {
      limit: 60,
      partialize: (state) => ({ doc: state.doc, progress: state.progress }),
      // 只比较被追踪的两个引用：syncSummary 之类的 set 不产生历史条目，
      // 否则「撤销一次」会退到一个一模一样的状态，看起来像没反应。
      equality: (past, current) =>
        past.doc === current.doc && past.progress === current.progress,
    },
  ),
);

/** 进度与结构变更后统一落库（防抖），避免拖拽/连线时刷爆存储 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let docTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProgress: { id: string; doc: ProgressDoc } | null = null;
let pendingDoc: { id: string; doc: Blueprint } | null = null;

async function persistProgress(): Promise<void> {
  const job = pendingProgress;
  pendingProgress = null;
  if (!job || !repo) return;
  try {
    await repo.saveProgress(job.id, job.doc);
    useAppStore.setState({ savedAt: Date.now(), saveError: null });
  } catch (err) {
    console.warn("[bluemap] 保存进度失败", err);
    useAppStore.setState({ saveError: String(err) });
  }
}

async function persistDoc(): Promise<void> {
  const job = pendingDoc;
  pendingDoc = null;
  if (!job || !repo) return;
  try {
    await repo.saveBlueprint(job.id, job.doc);
    useAppStore.setState({ savedAt: Date.now(), saveError: null });
  } catch (err) {
    console.warn("[bluemap] 保存蓝图失败", err);
    useAppStore.setState({ saveError: String(err) });
  }
}

/**
 * 立刻把待写数据发出去（不等防抖）。
 * 关窗口 / 切到后台 / 页面卸载时调用，避免「改完马上关」丢最后一笔。
 */
export async function flushSaves(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (docTimer) {
    clearTimeout(docTimer);
    docTimer = null;
  }
  await Promise.all([persistProgress(), persistDoc()]);
}

useAppStore.subscribe((state, prev) => {
  if (state.progress !== prev.progress && state.activeId) {
    pendingProgress = { id: state.activeId, doc: state.progress };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persistProgress();
    }, 220);
  }
  if (state.doc !== prev.doc && state.activeId && state.doc) {
    pendingDoc = { id: state.activeId, doc: state.doc };
    if (docTimer) clearTimeout(docTimer);
    docTimer = setTimeout(() => {
      docTimer = null;
      void persistDoc();
    }, 300);
  }
});
export const undo = () => useAppStore.temporal.getState().undo();
export const redo = () => useAppStore.temporal.getState().redo();

/** 仅测试用：注入内存仓库，避免依赖 IndexedDB */
export function __setRepo(next: Repo | null): void {
  repo = next;
}

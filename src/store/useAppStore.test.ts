import { beforeEach, describe, expect, it } from "vitest";
import { redo, undo, useAppStore, __setRepo } from "./useAppStore";
import { createMemoryRepo } from "../persist/repo";
import { detectCycle } from "../domain/graph";
import { SEED_BLUEPRINTS, seedNodeStates } from "../data";

const bp = SEED_BLUEPRINTS[0]; // 嵌入式

function reset() {
  useAppStore.setState({
    doc: bp,
    activeId: bp.id,
    progress: { nodes: seedNodeStates(bp), pos: {} },
    selectedId: null,
  });
  useAppStore.temporal.getState().clear();
}

beforeEach(reset);

describe("store · blueprint editing", () => {
  it("creates a node, selects it and gives it progress state", () => {
    const { addNode } = useAppStore.getState();
    addNode(
      { id: "n-test", title: "测试节点", sub: "", type: "concept", tier: 0, row: 0, resources: [] },
      { x: 10, y: 20 },
    );
    const s = useAppStore.getState();
    expect(s.doc?.nodes.find((n) => n.id === "n-test")).toBeTruthy();
    expect(s.selectedId).toBe("n-test");
    expect(s.progress.nodes["n-test"]).toBeTruthy();
    expect(s.progress.pos["n-test"]).toEqual({ x: 10, y: 20 });
  });

  it("connects valid nodes and rejects a cycle with a reason", () => {
    const { connect } = useAppStore.getState();
    expect(connect("emb-c", "emb-rtos").ok).toBe(true);
    expect(useAppStore.getState().doc?.edges.at(-1)).toMatchObject({
      from: "emb-c",
      to: "emb-rtos",
    });

    const bad = connect("emb-rtos", "emb-c");
    expect(bad.ok).toBe(false);
    expect(bad.reason).toContain("循环");
  });

  it("deletes a node together with its edges and progress", () => {
    const { deleteNode } = useAppStore.getState();
    const before = useAppStore.getState().doc!;
    const touching = before.edges.filter((e) => e.from === "emb-gpio" || e.to === "emb-gpio").length;

    deleteNode("emb-gpio");
    const after = useAppStore.getState();

    expect(after.doc?.nodes.find((n) => n.id === "emb-gpio")).toBeUndefined();
    expect(after.doc?.edges).toHaveLength(before.edges.length - touching);
    expect(after.progress.nodes["emb-gpio"]).toBeUndefined();
  });

  it("undoes and redoes structural edits", () => {
    const { addNode } = useAppStore.getState();
    const count = useAppStore.getState().doc!.nodes.length;

    addNode(
      { id: "n-undo", title: "可撤销", sub: "", type: "concept", tier: 0, row: 0, resources: [] },
      { x: 0, y: 0 },
    );
    expect(useAppStore.getState().doc?.nodes).toHaveLength(count + 1);

    undo();
    expect(useAppStore.getState().doc?.nodes).toHaveLength(count);

    redo();
    expect(useAppStore.getState().doc?.nodes).toHaveLength(count + 1);
  });

  it("undoes a mastery change", () => {
    useAppStore.getState().setMastery("emb-c", 0);
    expect(useAppStore.getState().progress.nodes["emb-c"].mastery).toBe(0);
    undo();
    expect(useAppStore.getState().progress.nodes["emb-c"].mastery).toBe(4);
  });

  it("edits a node title and hours, and undoes it", () => {
    const before = useAppStore.getState().doc!.nodes.find((n) => n.id === "emb-c")!;
    expect(before.title).toBe("C 语言与内存");

    useAppStore.getState().updateNodeField("emb-c", { title: "C 语言深入", hours: 60 });
    const edited = useAppStore.getState().doc!.nodes.find((n) => n.id === "emb-c")!;
    expect(edited.title).toBe("C 语言深入");
    expect(edited.hours).toBe(60);

    undo();
    const restored = useAppStore.getState().doc!.nodes.find((n) => n.id === "emb-c")!;
    expect(restored.title).toBe("C 语言与内存");
    expect(restored.hours).toBe(before.hours);
  });

  it("relayouts every node and adds a free node to the right", () => {    useAppStore.getState().relayout();
    expect(Object.keys(useAppStore.getState().progress.pos)).toHaveLength(bp.nodes.length);

    const before = useAppStore.getState().doc!.nodes.length;
    useAppStore.getState().addNodeFree();
    const after = useAppStore.getState();

    expect(after.doc!.nodes).toHaveLength(before + 1);
    const added = after.doc!.nodes.at(-1)!;
    expect(added.title).toBe("新节点");
    expect(after.progress.pos[added.id].x).toBeGreaterThan(0);
  });
});

describe("store · review", () => {
  it("grades a review, raises mastery and pushes the due date out", () => {
    const before = useAppStore.getState().progress.nodes["emb-c"];
    useAppStore.getState().review("emb-c", "good");
    const after = useAppStore.getState().progress.nodes["emb-c"];

    expect(after.mastery).toBe(Math.min(5, before.mastery + 1));
    expect(after.intervalDays).toBeGreaterThan(before.intervalDays);
    expect(after.dueAt).toBeGreaterThan(Date.now());
  });

  it("demotes mastery when the answer is forgotten", () => {
    const before = useAppStore.getState().progress.nodes["emb-c"];
    useAppStore.getState().review("emb-c", "again");
    const after = useAppStore.getState().progress.nodes["emb-c"];

    expect(after.mastery).toBe(Math.max(2, before.mastery - 1));
    expect(after.intervalDays).toBe(1);
    expect(after.dueAt).toBeLessThan(Date.now() + 2 * 86400000);
  });

  it("opens and closes the review drawer state", () => {
    useAppStore.getState().setReviewOpen(true);
    expect(useAppStore.getState().reviewOpen).toBe(true);
    useAppStore.getState().setReviewOpen(false);
    expect(useAppStore.getState().reviewOpen).toBe(false);
  });
});

describe("掌握度来源：AI 问答 + 作品评估", () => {
  beforeEach(() => {
    __setRepo(createMemoryRepo());
  });

  it("AI 问答分数会写进 progress，并与手动值取较小值", () => {
    useAppStore.getState().setMastery("emb-gpio", 5);
    useAppStore.getState().applyQuiz("emb-gpio", {
      score: 3,
      summary: "能跑通但说不清",
      at: Date.now(),
      qa: [{ q: "Q1", a: "A1" }],
    });

    const state = useAppStore.getState().progress.nodes["emb-gpio"];
    expect(state.aiQuiz?.score).toBe(3);
    expect(state.aiQuiz?.qa).toHaveLength(1);
    expect(state.mastery).toBe(3); // min(5, 3)
  });

  it("没有任何 AI 证据时保留手动掌握度", () => {
    useAppStore.getState().setMastery("emb-gpio", 2);
    expect(useAppStore.getState().progress.nodes["emb-gpio"].mastery).toBe(2);
  });

  it("作品评估分数参与掌握度计算", () => {
    useAppStore.getState().attachArtifact("emb-gpio", {
      kind: "repo",
      ref: "https://example.com/repo",
      at: Date.now(),
      review: { score: 2, summary: "只是跟着教程敲的", at: Date.now() },
    });
    expect(useAppStore.getState().progress.nodes["emb-gpio"].mastery).toBe(2);
  });

  it("问答与作品同时存在时取更保守的那个", () => {
    useAppStore.getState().applyQuiz("emb-gpio", {
      score: 5,
      summary: "答得很好",
      at: Date.now(),
      qa: [],
    });
    useAppStore.getState().attachArtifact("emb-gpio", {
      kind: "local",
      ref: "D:/demo",
      at: Date.now(),
      review: { score: 2, summary: "作品偏简单", at: Date.now() },
    });
    expect(useAppStore.getState().progress.nodes["emb-gpio"].mastery).toBe(2);
  });
});
describe("store · AI expand", () => {
  beforeEach(() => {
    __setRepo(createMemoryRepo());
  });

  it("creates a child blueprint and links it to the parent node", async () => {
    const id = await useAppStore.getState().createChildBlueprint("emb-rtos", [
      { title: "任务创建与调度", sub: "xTaskCreate", hours: 4 },
      { title: "队列与信号量", sub: "生产者消费者", hours: 3 },
    ]);

    expect(id).toBeTruthy();
    const state = useAppStore.getState();

    expect(state.activeId).toBe(id);
    expect(state.doc?.parentId).toBe("emb");
    expect(state.doc?.nodes).toHaveLength(2);
    expect(state.list.find((b) => b.id === id)?.parentId).toBe("emb");

    const link = state.links.find((l) => l.toBp === id);
    expect(link).toBeTruthy();
    expect(link?.toNode).toBe("");
    expect(link?.fromNode).toBe("emb-rtos");
    expect(link?.toBpTitle).toBe("FreeRTOS 任务与同步");
    expect(state.expand).toBeNull();
  });

  it("refuses to create a child blueprint without drafts", async () => {
    const id = await useAppStore.getState().createChildBlueprint("emb-rtos", []);
    expect(id).toBe("");
  });

  it("cancels an expand preview", () => {
    useAppStore.setState({
      expand: { nodeId: "emb-c", drafts: [], busy: false, error: null },
    });
    useAppStore.getState().cancelExpand();
    expect(useAppStore.getState().expand).toBeNull();
  });
});

describe("store · blueprint lifecycle", () => {
  beforeEach(() => {
    __setRepo(createMemoryRepo());
  });

  it("creates a blueprint and opens it", async () => {
    const id = await useAppStore.getState().createBlueprint("新蓝图", "先跑通一个 demo");
    expect(id).toBeTruthy();

    const state = useAppStore.getState();
    expect(state.activeId).toBe(id);
    expect(state.doc?.title).toBe("新蓝图");
    expect(state.doc?.nodes).toHaveLength(0);
    expect(state.list.some((b) => b.id === id)).toBe(true);
  });

  it("deletes a blueprint and falls back to another one", async () => {
    const id = await useAppStore.getState().createBlueprint("临时蓝图", "");
    expect(useAppStore.getState().activeId).toBe(id);

    await useAppStore.getState().deleteBlueprint(id);
    const state = useAppStore.getState();

    expect(state.list.some((b) => b.id === id)).toBe(false);
    expect(state.activeId).not.toBe(id);
    expect(state.doc).toBeTruthy();
  });

  it("keeps the seeded four when nothing is deleted", async () => {
    await useAppStore.getState().refreshList();
    expect(useAppStore.getState().list.map((b) => b.id)).toEqual([
      "emb",
      "vue",
      "react",
      "se",
    ]);
  });

  it("删除节点时一并清掉指向它的跨蓝图关联", async () => {
    useAppStore.setState({
      links: [
        { id: "l1", fromBp: "emb", fromNode: "emb-c", toBp: "react", toNode: "re-core" },
        { id: "l2", fromBp: "react", fromNode: "re-core", toBp: "emb", toNode: "emb-c" },
        { id: "l3", fromBp: "emb", fromNode: "emb-gpio", toBp: "react", toNode: "re-core" },
      ],
    });

    await useAppStore.getState().deleteNode("emb-c");
    const state = useAppStore.getState();

    expect(state.doc?.nodes.some((n) => n.id === "emb-c")).toBe(false);
    expect(state.links.map((l) => l.id)).toEqual(["l3"]);
  });
});

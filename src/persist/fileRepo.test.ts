import { describe, expect, it } from "vitest";
import { FileRepo } from "./fileRepo";
import { emptyNodeState } from "../domain/types";

type Kind = "blueprint" | "progress" | "setting" | "link";

function fakeBridge(initial?: unknown) {
  const data = {
    blueprints: {},
    progress: {},
    settings: {},
    links: {},
  } as Record<string, Record<string, unknown>>;
  const writes: string[] = [];

  const tableFor = (kind: Kind) =>
    ({
      blueprint: data.blueprints,
      progress: data.progress,
      setting: data.settings,
      link: data.links,
    })[kind];

  return {
    data,
    writes,
    bridge: {
      load: async () => (initial ? JSON.parse(JSON.stringify(initial)) : JSON.parse(JSON.stringify(data))),
      write: async (kind: Kind, id: string, value: unknown) => {
        writes.push(`${kind}:${id}`);
        const table = tableFor(kind);
        if (value === null || value === undefined) delete table[id];
        else table[id] = value;
        return { ok: true };
      },
    },
  };
}

describe("FileRepo（桌面端本地 JSON 仓库）", () => {
  it("首次启动补种 4 张内置蓝图并写回主进程", async () => {
    const { bridge, data, writes } = fakeBridge();
    const repo = await FileRepo.create(bridge);

    expect(repo.persistent).toBe(true);
    expect(await repo.listBlueprints()).toHaveLength(4);
    expect(Object.keys(data.blueprints)).toHaveLength(4);
    expect(Object.keys(data.progress)).toHaveLength(4);
    expect(writes.length).toBeGreaterThan(0);
  });

  it("已有数据时不再补种", async () => {
    const existing = {
      blueprints: { emb: { id: "emb", title: "已有蓝图", goal: "", nodes: [], edges: [] } },
      progress: { emb: { nodes: {}, pos: {} } },
      settings: {},
      links: {},
    };
    const { bridge } = fakeBridge(existing);
    const repo = await FileRepo.create(bridge);

    const list = await repo.listBlueprints();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("已有蓝图");
  });

  it("写蓝图与进度会同时进内存和主进程", async () => {
    const { bridge, data } = fakeBridge();
    const repo = await FileRepo.create(bridge);

    const state = emptyNodeState(5);
    await repo.saveProgress("emb", { nodes: { a: state }, pos: {} });
    expect((await repo.getProgress("emb"))?.nodes.a.mastery).toBe(5);
    expect(data.progress.emb).toMatchObject({ nodes: { a: { mastery: 5 } } });
  });

  it("删蓝图时进度一起清掉", async () => {
    const { bridge, data } = fakeBridge();
    const repo = await FileRepo.create(bridge);

    await repo.deleteBlueprint("emb");
    expect(await repo.getBlueprint("emb")).toBeNull();
    expect(await repo.getProgress("emb")).toBeNull();
    expect(data.blueprints.emb).toBeUndefined();
    expect(data.progress.emb).toBeUndefined();
  });

  it("AI 问答与作品评估随进度一起落盘", async () => {
    const { bridge, data } = fakeBridge();
    const repo = await FileRepo.create(bridge);

    const state = emptyNodeState(4);
    state.aiQuiz = {
      score: 4,
      summary: "讲清了队列和信号量的取舍",
      at: 1,
      qa: [{ q: "队列满了怎么办？", a: "阻塞或丢包，看场景" }],
    };
    state.artifacts = [
      { kind: "repo", ref: "https://example.com/x", at: 1, review: { score: 4, summary: "结构清晰", at: 1 } },
    ];
    await repo.saveProgress("emb", { nodes: { a: state }, pos: {} });

    // 直接看落盘数据（等价于重启后读到的内容）
    const saved = (data.progress.emb as { nodes: Record<string, typeof state> }).nodes.a;
    expect(saved.aiQuiz?.summary).toContain("队列");
    expect(saved.aiQuiz?.qa[0].q).toContain("队列满了");
    expect(saved.artifacts?.[0].review?.score).toBe(4);
  });

  it("设置项与跨蓝图关联都能往返", async () => {
    const { bridge } = fakeBridge();
    const repo = await FileRepo.create(bridge);

    await repo.setSetting("ai", { key: "sk-test", model: "deepseek-chat" });
    expect(await repo.getSetting("ai")).toMatchObject({ key: "sk-test" });

    await repo.saveLink({
      id: "l1",
      fromBp: "emb",
      fromNode: "emb-c",
      toBp: "react",
      toNode: "re-core",
    });
    expect(await repo.listLinks()).toHaveLength(1);

    await repo.deleteLink("l1");
    expect(await repo.listLinks()).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { LocalStorageRepo } from "./localStorageRepo";
import { seedRepo } from "./seed";
import { emptyNodeState } from "../domain/types";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe("LocalStorageRepo（IndexedDB 不可用时的持久化兜底）", () => {
  it("补种内置蓝图，并能被下一次启动读回来", async () => {
    const storage = fakeStorage();

    const first = LocalStorageRepo.create(storage);
    expect(await seedRepo(first)).toBe(true);
    expect(await first.listBlueprints()).toHaveLength(4);

    // 模拟「关掉再打开」：同一个 storage，新建仓库实例
    const second = LocalStorageRepo.create(storage);
    const list = await second.listBlueprints();
    expect(list.map((b) => b.id).sort()).toEqual(["emb", "react", "se", "vue"]);
    expect(list).toHaveLength(4);
  });

  it("掌握度改动会写穿到 storage", async () => {
    const storage = fakeStorage();
    const repo = LocalStorageRepo.create(storage);
    await seedRepo(repo);

    await repo.saveProgress("emb", { nodes: { a: emptyNodeState(4) }, pos: {} });

    const reopened = LocalStorageRepo.create(storage);
    expect((await reopened.getProgress("emb"))?.nodes.a.mastery).toBe(4);
    expect(reopened.persistent).toBe(true);
  });

  it("设置与跨蓝图关联同样持久化", async () => {
    const storage = fakeStorage();
    const repo = LocalStorageRepo.create(storage);
    await seedRepo(repo);

    await repo.setSetting("ai", { key: "sk-local" });
    await repo.saveLink({
      id: "l1",
      fromBp: "emb",
      fromNode: "emb-c",
      toBp: "react",
      toNode: "re-core",
    });

    const reopened = LocalStorageRepo.create(storage);
    expect(await reopened.getSetting("ai")).toMatchObject({ key: "sk-local" });
    expect(await reopened.listLinks()).toHaveLength(1);
  });

  it("坏数据不会让启动失败", () => {
    const storage = fakeStorage();
    storage.setItem("bluemap.data.v1", "{not json");
    const repo = LocalStorageRepo.create(storage);
    expect(repo.persistent).toBe(true);
  });
});

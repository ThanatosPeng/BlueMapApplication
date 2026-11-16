import type { Blueprint, ProgressDoc } from "../domain/types";
import type { CrossLink } from "../domain/links";
import { SEED_BLUEPRINTS, seedNodeStates } from "../data";
import { layoutWithDagre } from "../domain/layout";
import { db } from "./db";
import { seedRepo } from "./seed";
import { LocalStorageRepo } from "./localStorageRepo";
import { FileRepo, type StoreBridge } from "./fileRepo";

export interface Repo {
  /** 是否真的写到磁盘/存储，false 时界面会提示「只保存在内存」 */
  persistent: boolean;
  /** 给用户看的一句话，比如「本地文件 bluemap.json」 */
  label: string;
  listBlueprints(): Promise<Blueprint[]>;
  getBlueprint(id: string): Promise<Blueprint | null>;
  saveBlueprint(id: string, doc: Blueprint): Promise<void>;
  deleteBlueprint(id: string): Promise<void>;
  getProgress(id: string): Promise<ProgressDoc | null>;
  saveProgress(id: string, doc: ProgressDoc): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  listLinks(): Promise<CrossLink[]>;
  saveLink(link: CrossLink): Promise<void>;
  deleteLink(id: string): Promise<void>;
}

/** 内存兜底：隐私模式、IDB 被禁用、无头环境下的降级路径 */
class MemoryRepo implements Repo {
  persistent = false;
  label = "内存（不保存）";
  private blueprints = new Map<string, Blueprint>();
  private progress = new Map<string, ProgressDoc>();
  private settings = new Map<string, unknown>();
  private links = new Map<string, CrossLink>();

  constructor() {
    for (const bp of SEED_BLUEPRINTS) {
      this.blueprints.set(bp.id, bp);
      this.progress.set(bp.id, {
        nodes: seedNodeStates(bp),
        pos: layoutWithDagre(bp),
      });
    }
  }

  async listBlueprints() {
    return Array.from(this.blueprints.values());
  }
  async getBlueprint(id: string) {
    return this.blueprints.get(id) ?? null;
  }
  async saveBlueprint(id: string, doc: Blueprint) {
    this.blueprints.set(id, doc);
  }
  async deleteBlueprint(id: string) {
    this.blueprints.delete(id);
    this.progress.delete(id);
  }
  async getProgress(id: string) {
    return this.progress.get(id) ?? null;
  }
  async saveProgress(id: string, doc: ProgressDoc) {
    this.progress.set(id, doc);
  }
  async getSetting<T>(key: string) {
    return (this.settings.get(key) as T) ?? null;
  }
  async setSetting<T>(key: string, value: T) {
    this.settings.set(key, value);
  }
  async listLinks() {
    return Array.from(this.links.values());
  }
  async saveLink(link: CrossLink) {
    this.links.set(link.id, link);
  }
  async deleteLink(id: string) {
    this.links.delete(id);
  }
}

class DexieRepo implements Repo {
  persistent = true;
  label = "浏览器 IndexedDB";

  async listBlueprints() {
    const rows = await db.blueprints.toArray();
    return rows.map((r) => r.doc);
  }
  async getBlueprint(id: string) {
    const row = await db.blueprints.get(id);
    return row?.doc ?? null;
  }
  async saveBlueprint(id: string, doc: Blueprint) {
    await db.blueprints.put({ id, doc, updatedAt: Date.now() });
  }
  async deleteBlueprint(id: string) {
    await db.transaction("rw", db.blueprints, db.progress, async () => {
      await db.blueprints.delete(id);
      await db.progress.delete(id);
    });
  }
  async getProgress(id: string) {
    const row = await db.progress.get(id);
    return row?.doc ?? null;
  }
  async saveProgress(id: string, doc: ProgressDoc) {
    await db.progress.put({ blueprintId: id, doc, updatedAt: Date.now() });
  }
  async getSetting<T>(key: string) {
    const row = await db.settings.get(key);
    return (row?.value as T) ?? null;
  }
  async setSetting<T>(key: string, value: T) {
    await db.settings.put({ key, value });
  }
  async listLinks() {
    return db.links.toArray();
  }
  async saveLink(link: CrossLink) {
    await db.links.put(link);
  }
  async deleteLink(id: string) {
    await db.links.delete(id);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`storage timeout after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * 启动时选仓库：
 *
 * 1. Electron（有 window.bluemap.store）→ 本地 JSON 文件仓库，数据在内存、主进程落盘；
 * 2. 浏览器 → IndexedDB；4 秒没响应就退回内存，宁可少持久化也不让界面卡在「加载中」。
 */
export async function createRepo(): Promise<Repo> {
  const bridge = typeof window !== "undefined" ? window.bluemap?.store : undefined;
  if (bridge) {
    try {
      return await FileRepo.create(bridge as StoreBridge);
    } catch (err) {
      console.warn("[bluemap] 本地文件存储不可用，改用 localStorage", err);
      return createFallbackRepo();
    }
  }

  try {
    await withTimeout(
      (async () => {
        await db.open();
        await db.blueprints.count();
        await seedRepo(new DexieRepo());
      })(),
      4000,
    );
    return new DexieRepo();
  } catch (err) {
    console.warn("[bluemap] IndexedDB unavailable, fallback to localStorage", err);
    return createFallbackRepo();
  }
}

/**
 * 两条降级路径的共同终点：
 * localStorage 持久化 → 真不行（隐私模式禁写）才落到内存。
 * 绝不再让「IDB 坏了」直接等于「数据不保存」。
 */
async function createFallbackRepo(): Promise<Repo> {
  try {
    const storage = LocalStorageRepo.create(window.localStorage);
    await seedRepo(storage);
    return storage;
  } catch (err) {
    console.warn("[bluemap] localStorage 不可用，只能存内存", err);
    return new MemoryRepo();
  }
}

/** 测试注入用：不碰 IndexedDB 的内存仓库 */
export function createMemoryRepo(): Repo {
  return new MemoryRepo();
}

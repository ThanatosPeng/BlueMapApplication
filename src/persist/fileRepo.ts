import type { Blueprint, ProgressDoc } from "../domain/types";
import type { CrossLink } from "../domain/links";
import type { Repo } from "./repo";
import { seedRepo } from "./seed";

interface StoreSnapshot {
  blueprints?: Record<string, Blueprint>;
  progress?: Record<string, ProgressDoc>;
  settings?: Record<string, unknown>;
  links?: Record<string, CrossLink>;
}

export interface StoreBridge {
  load(): Promise<unknown>;
  write(
    kind: "blueprint" | "progress" | "setting" | "link",
    id: string,
    value: unknown,
  ): Promise<{ ok: boolean; reason?: string }>;
}

/**
 * 桌面端仓库：数据常驻内存，写操作同步走主进程（主进程再防抖落盘到 JSON）。
 *
 * 为什么不用 IndexedDB：Electron 里它的可用性依赖 profile 目录权限，
 * 一旦不可写就静默降级成内存，用户会在"刷新即丢失"的状态下白学一天。
 * 文件仓库把这件事交给主进程，可控、可排查、可备份（一个 bluemap.json）。
 */
export class FileRepo implements Repo {
  persistent = true;
  label = "本地文件 bluemap.json";

  private blueprints = new Map<string, Blueprint>();
  private progress = new Map<string, ProgressDoc>();
  private settings = new Map<string, unknown>();
  private links = new Map<string, CrossLink>();

  private constructor(private bridge: StoreBridge, snapshot: StoreSnapshot) {
    for (const [id, doc] of Object.entries(snapshot.blueprints ?? {})) {
      this.blueprints.set(id, doc);
    }
    for (const [id, doc] of Object.entries(snapshot.progress ?? {})) {
      this.progress.set(id, doc);
    }
    for (const [key, value] of Object.entries(snapshot.settings ?? {})) {
      this.settings.set(key, value);
    }
    for (const [id, link] of Object.entries(snapshot.links ?? {})) {
      this.links.set(id, link);
    }
  }

  /** 启动时把主进程内存里的快照读进渲染进程，并补种内置蓝图 */
  static async create(bridge: StoreBridge): Promise<FileRepo> {
    const snapshot = ((await bridge.load()) ?? {}) as StoreSnapshot;
    const repo = new FileRepo(bridge, snapshot);
    await seedRepo(repo);
    return repo;
  }

  async listBlueprints() {
    return Array.from(this.blueprints.values());
  }

  async getBlueprint(id: string) {
    return this.blueprints.get(id) ?? null;
  }

  async saveBlueprint(id: string, doc: Blueprint) {
    this.blueprints.set(id, doc);
    await this.writeOrThrow("blueprint", id, doc);
  }

  /** 主进程返回 ok:false 时必须让上层知道，否则界面会谎报「已保存」 */
  private async writeOrThrow(
    kind: "blueprint" | "progress" | "setting" | "link",
    id: string,
    value: unknown,
  ): Promise<void> {
    const result = await this.bridge.write(kind, id, value);
    if (!result.ok) throw new Error(result.reason ?? "写入本地文件失败");
  }

  async deleteBlueprint(id: string) {
    this.blueprints.delete(id);
    this.progress.delete(id);
    await this.writeOrThrow("blueprint", id, null);
    await this.writeOrThrow("progress", id, null);
  }

  async getProgress(id: string) {
    return this.progress.get(id) ?? null;
  }

  async saveProgress(id: string, doc: ProgressDoc) {
    this.progress.set(id, doc);
    await this.writeOrThrow("progress", id, doc);
  }

  async getSetting<T>(key: string) {
    return (this.settings.get(key) as T) ?? null;
  }

  async setSetting<T>(key: string, value: T) {
    this.settings.set(key, value);
    await this.writeOrThrow("setting", key, value);
  }

  async listLinks() {
    return Array.from(this.links.values());
  }

  async saveLink(link: CrossLink) {
    this.links.set(link.id, link);
    await this.writeOrThrow("link", link.id, link);
  }

  async deleteLink(id: string) {
    this.links.delete(id);
    await this.writeOrThrow("link", id, null);
  }
}

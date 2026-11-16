import type { Blueprint, ProgressDoc } from "../domain/types";
import type { CrossLink } from "../domain/links";
import type { Repo } from "./repo";

const KEY = "bluemap.data.v1";

interface Snapshot {
  blueprints: Record<string, Blueprint>;
  progress: Record<string, ProgressDoc>;
  settings: Record<string, unknown>;
  links: Record<string, CrossLink>;
}

const emptySnapshot = (): Snapshot => ({
  blueprints: {},
  progress: {},
  settings: {},
  links: {},
});

/**
 * localStorage 仓库：IndexedDB 不可用时的持久化兜底。
 *
 * 之前这里直接退回内存，结果就是「关掉即丢」。localStorage 容量小（约 5MB），
 * 但整份数据才 50KB 左右，完全够用，而且同步写、无兼容坑。
 */
export class LocalStorageRepo implements Repo {
  persistent = true;
  label = "浏览器 localStorage";

  private data: Snapshot;
  private storage: Storage;

  private constructor(snapshot: Snapshot, storage: Storage) {
    this.data = snapshot;
    this.storage = storage;
  }

  static create(storage: Storage): LocalStorageRepo {
    let snapshot = emptySnapshot();
    try {
      const raw = storage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Snapshot>;
        snapshot = {
          blueprints: parsed.blueprints ?? {},
          progress: parsed.progress ?? {},
          settings: parsed.settings ?? {},
          links: parsed.links ?? {},
        };
      }
    } catch (err) {
      console.warn("[bluemap] localStorage 数据解析失败，按空数据启动", err);
    }
    return new LocalStorageRepo(snapshot, storage);
  }

  private persist() {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn("[bluemap] 写入 localStorage 失败", err);
    }
  }

  async listBlueprints() {
    return Object.values(this.data.blueprints);
  }

  async getBlueprint(id: string) {
    return this.data.blueprints[id] ?? null;
  }

  async saveBlueprint(id: string, doc: Blueprint) {
    this.data.blueprints[id] = doc;
    this.persist();
  }

  async deleteBlueprint(id: string) {
    delete this.data.blueprints[id];
    delete this.data.progress[id];
    this.persist();
  }

  async getProgress(id: string) {
    return this.data.progress[id] ?? null;
  }

  async saveProgress(id: string, doc: ProgressDoc) {
    this.data.progress[id] = doc;
    this.persist();
  }

  async getSetting<T>(key: string) {
    return (this.data.settings[key] as T) ?? null;
  }

  async setSetting<T>(key: string, value: T) {
    this.data.settings[key] = value;
    this.persist();
  }

  async listLinks() {
    return Object.values(this.data.links);
  }

  async saveLink(link: CrossLink) {
    this.data.links[link.id] = link;
    this.persist();
  }

  async deleteLink(id: string) {
    delete this.data.links[id];
    this.persist();
  }
}

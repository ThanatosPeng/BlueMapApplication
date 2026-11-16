const fs = require("node:fs");
const path = require("node:path");

const emptyData = () => ({
  version: 1,
  blueprints: {},
  progress: {},
  settings: {},
  links: {},
});

/**
 * 主进程侧的 JSON 仓库。
 *
 * 设计：所有数据常驻内存（this.data），渲染进程每次写都是一次 IPC，
 * 主进程改完内存后用 250ms 防抖把整份数据原子写回磁盘（tmp + rename）。
 * 这样界面永远不等磁盘 IO，掉电最多丢最后 250ms 的操作。
 */
class FileStore {
  constructor(file) {
    this.file = file;
    this.data = emptyData();
    this.timer = null;
    this.writes = 0;
    this.lastWriteAt = null;
    this.lastError = null;
    this.loaded = { exists: false, bytes: 0, error: null };
    this.autoTimer = null;
    this.autoSaveAt = null;
    this.autoSaveCount = 0;
    this.autoSaveIntervalMs = 0;
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, "utf8");
      const parsed = JSON.parse(raw);
      this.loaded = { exists: true, bytes: raw.length, error: null };
      this.data = {
        version: parsed.version ?? 1,
        blueprints: parsed.blueprints ?? {},
        progress: parsed.progress ?? {},
        settings: parsed.settings ?? {},
        links: parsed.links ?? {},
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        this.loaded = { exists: false, bytes: 0, error: null };
    this.autoTimer = null;
    this.autoSaveAt = null;
    this.autoSaveCount = 0;
    this.autoSaveIntervalMs = 0;
        this.data = emptyData();
      } else {
        // 文件坏了不要静默覆盖：先备份，再按空数据启动
        const backup = `${this.file}.corrupt-${Date.now()}`;
        try {
          fs.renameSync(this.file, backup);
        } catch {
          /* 备份失败也只能继续 */
        }
        console.warn("[bluemap] 读取本地数据失败，已备份到", backup, error.message);
        this.loaded = { exists: true, bytes: 0, error: `读取失败（已备份）：${error.message}` };
        this.data = emptyData();
      }
    }
    return this.data;
  }

  snapshot() {
    return this.data;
  }

  tableFor(kind) {
    switch (kind) {
      case "blueprint":
        return this.data.blueprints;
      case "progress":
        return this.data.progress;
      case "setting":
        return this.data.settings;
      case "link":
        return this.data.links;
      default:
        return null;
    }
  }

  write(kind, id, value) {
    const table = this.tableFor(kind);
    if (!table || typeof id !== "string" || !id) {
      return { ok: false, reason: "非法的写入请求" };
    }

    if (value === null || value === undefined) {
      delete table[id];
      // 删蓝图时连同它的进度一起清掉
      if (kind === "blueprint") delete this.data.progress[id];
    } else {
      table[id] = value;
    }

    // 立即落盘：写入不成功就不告诉界面「已保存」
    this.writes += 1;
    const ok = this.flush();
    return ok ? { ok: true } : { ok: false, reason: this.lastError ?? "写入失败" };
  }

  flush() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data), "utf8");
      fs.renameSync(tmp, this.file);
      this.lastWriteAt = Date.now();
      this.lastError = null;
      return true;
    } catch (error) {
      this.lastError = error.message;
      console.warn("[bluemap] 写入本地数据失败：", error.message);
      return false;
    }
  }

  info() {
    return {
      file: this.file,
      writes: this.writes,
      lastWriteAt: this.lastWriteAt,
      lastError: this.lastError,
      loaded: this.loaded,
      autoSave: {
        intervalMs: this.autoSaveIntervalMs,
        lastAt: this.autoSaveAt,
        count: this.autoSaveCount,
      },
    };
  }

  /**
   * 定时把整份数据写回磁盘。和「改动即写」互补：
   * 即使某条写路径漏了，10 秒内也会兜住。间隔可用 BLUEMAP_AUTOSAVE_MS 覆盖（测试用）。
   */
  startAutoSave(intervalMs = 10000) {
    this.stopAutoSave();
    this.autoSaveIntervalMs = intervalMs;
    this.autoTimer = setInterval(() => {
      this.autoSaveCount += 1;
      this.autoSaveAt = Date.now();
      this.flush();
    }, intervalMs);
    // 不要因为定时器让进程无法退出
    this.autoTimer.unref?.();
  }

  stopAutoSave() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  /** 退出前同步落盘 */
  flushNow() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

module.exports = { FileStore };

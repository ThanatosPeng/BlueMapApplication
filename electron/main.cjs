const { app, BrowserWindow, ipcMain, net, shell } = require("electron");

const path = require("node:path");
const fs = require("node:fs");
const { APP_URL, registerAppProtocol } = require("./protocol.cjs");
const { FileStore } = require("./store.cjs");

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const DIST_DIR = path.join(__dirname, "..", "dist");

/** 整个应用的数据仓库：内存里一份，防抖落盘到 userData/bluemap.json */
let store = null;
let isQuitting = false;

/**
 * 旧版本曾把数据写进 %TEMP% 或 cwd（现在不再用这两个位置）。
 * 首次启动时如果新位置没有文件，就把旧位置最新的那份搬过来，避免用户白学。
 */
function migrateLegacyData(targetFile) {
  if (fs.existsSync(targetFile)) return;

  const tempDir = (() => {
    try {
      return app.getPath("temp");
    } catch {
      return null;
    }
  })();

  // 早期版本把数据放在 %APPDATA%\BlueMap（开发版），打包版改用 %LOCALAPPDATA%，
  // 这里把旧位置的数据搬过来，避免升级后"进度不见了"
  const appDataDir = (() => {
    try {
      return app.getPath("appData");
    } catch {
      return null;
    }
  })();

  const legacy = [
    appDataDir ? path.join(appDataDir, "BlueMap", "bluemap.json") : null,
    appDataDir ? path.join(appDataDir, "bluemap", "bluemap.json") : null,
    tempDir ? path.join(tempDir, "bluemap-userdata", "bluemap.json") : null,
    path.join(process.cwd(), ".bluemap-userdata", "bluemap.json"),
    path.join(process.cwd(), ".electron-userdata", "bluemap.json"),
  ].filter((p) => p && fs.existsSync(p));

  if (legacy.length === 0) return;

  try {
    const newest = legacy
      .map((file) => ({ file, mtime: fs.statSync(file).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0];
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.copyFileSync(newest.file, targetFile);
    console.warn("[bluemap] 已迁移旧数据：", newest.file, "→", targetFile);
  } catch (error) {
    console.warn("[bluemap] 迁移旧数据失败：", error.message);
  }
}

function bootStore() {
  if (store) return store;
  const file = path.join(app.getPath("userData"), "bluemap.json");
  migrateLegacyData(file);
  store = new FileStore(file);
  store.load();
  const info = store.info();
  appendLog(
    `BOOT file=${file} exists=${info.loaded.exists} bytes=${info.loaded.bytes}` +
      `${info.loaded.error ? ` loadError=${info.loaded.error}` : ""}`,
  );
  console.log("[bluemap] 数据文件", file, info.loaded);

  // 读完之后立刻整份写一次：既确认目录可写，也让首启就落下一个完整文件
  const firstSave = store.flush();
  appendLog(`AUTOSAVE boot saved=${firstSave}`);

  // 之后每 10 秒兜底保存一次全量数据（可用环境变量改间隔，便于测试）
  const intervalMs = Number(process.env.BLUEMAP_AUTOSAVE_MS) || 10000;
  store.startAutoSave(intervalMs);
  appendLog(`AUTOSAVE started interval=${intervalMs}ms`);

  return store;
}

/** 排查用的简易日志，和数据文件放在一起 */
function appendLog(line) {
  try {
    const dir = path.dirname(store?.info().file ?? path.join(app.getPath("userData"), "bluemap.json"));
    fs.appendFileSync(path.join(dir, "bluemap.log"), `${new Date().toISOString()} ${line}\n`, "utf8");
  } catch {
    /* 日志失败不影响主流程 */
  }
}

/**
 * Chromium 把 IndexedDB / 缓存写在 userData 里。
 * 默认目录（%APPDATA%）在受限环境可能不可写，会导致存储静默失效甚至启动即退出，
 * 所以在做任何事之前，先挑一个确定能写的目录。
 */
function pickUserData() {
  const tryPath = (fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };

  const base = tryPath(() => app.getPath("userData"));
  const appData = tryPath(() => app.getPath("appData"));
  const localAppData = process.env.LOCALAPPDATA || null;
  const home = tryPath(() => app.getPath("home"));
  const documents = tryPath(() => app.getPath("documents"));

  // 只用「稳定」目录：@LOCALAPPDATA@ → @APPDATA@ → 用户主目录 → 文档。
  // 绝不用 %TEMP%（会被清理）或 process.cwd%（随启动方式变化），
  // 否则每次启动可能读到不同/空的文件，表现就是「改了没保存」。
  const candidates = [
    localAppData ? path.join(localAppData, "BlueMap") : null,
    base,
    appData ? path.join(appData, "BlueMap") : null,
    home ? path.join(home, ".bluemap") : null,
    documents ? path.join(documents, "BlueMap") : null,
  ].filter(Boolean);

  // 每个目录都用真实探针文件确认可写：只靠 accessSync 会骗人（ACL 允许但写不进去）。
  // 写成功但删探针失败也算可写——杀软/同步盘常这样，不能因此把数据甩到程序目录。
  const writable = (dir) =>
    tryPath(() => {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, ".write-probe");
      fs.writeFileSync(probe, "ok", "utf8");
      try {
        fs.unlinkSync(probe);
      } catch {
        /* 删不掉不影响写入能力 */
      }
      return true;
    });

  // 第一优先：哪个目录里已经有 bluemap.json 就用哪个。
  // 否则换启动方式（开发版 / 打包版 / 不同 cwd）会读到空库，
  // 用户看到的就是「历史进度没了」——这个坑踩过两次。
  for (const dir of candidates) {
    if (!fs.existsSync(path.join(dir, "bluemap.json"))) continue;
    if (!writable(dir)) continue;
    if (dir !== base) app.setPath("userData", dir);
    console.log("[bluemap] 复用已有数据目录", dir);
    return dir;
  }

  // 第二优先：第一个可写目录
  for (const dir of candidates) {
    if (!writable(dir)) continue;
    if (dir !== base) {
      app.setPath("userData", dir);
      console.warn("[bluemap] 默认数据目录不可写，改用", dir);
    }
    return dir;
  }

  // 全都不行才退回程序目录 data/（便携模式），并明确警告
  const fallback = path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(fallback, { recursive: true });
    app.setPath("userData", fallback);
    console.warn("[bluemap] 所有用户目录都不可写，退回", fallback);
  } catch {
    console.warn("[bluemap] 没有可写的数据目录，存储不可用");
  }
  return fallback;
}
pickUserData();

function createWindow() {
  const win = new BrowserWindow({
    show: process.env.BLUEMAP_HEADLESS !== "1",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#070d18",
    title: "BlueMap",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    // 不要用 loadFile：file:// 是 opaque origin，IndexedDB 会被禁用
    win.loadURL(APP_URL);
  }

  // 关窗前先让渲染进程把防抖中的保存发完，最多等 600ms
  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener("app:close-ready", finish);
      isQuitting = true;
      store?.flushNow();
      win.close();
    };

    ipcMain.once("app:close-ready", finish);
    win.webContents.send("app:before-close");
    setTimeout(finish, 600);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

/** AI 请求转发：渲染进程走 IPC，主进程用 net.fetch 直连，没有 CORS */
ipcMain.handle("ai:request", async (_event, payload) => {
  const { url, headers = {}, body } = payload || {};
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return { ok: false, status: 0, text: "只允许 http(s) 请求" };
  }
  try {
    const response = await net.fetch(url, { method: "POST", headers, body });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: String(error?.message ?? error) };
  }
});

/** 本地数据：启动时读一次，之后读写都在内存，防抖落盘 */
ipcMain.handle("store:load", () => {
  const s = store ?? bootStore();
  return s.snapshot();
});

ipcMain.handle("store:write", (_event, kind, id, value) => {
  const s = store ?? bootStore();
  const result = s.write(kind, id, value);
  appendLog(`WRITE ${kind} ${id} ok=${result.ok}${result.ok ? "" : ` reason=${result.reason}`}`);
  return result;
});

ipcMain.handle("store:info", () => {
  const s = store ?? bootStore();
  return s.info();
});

ipcMain.handle("store:flush", () => {
  store?.flushNow();
  return { ok: true };
});

app.whenReady().then(() => {
  bootStore();

  if (!DEV_URL) registerAppProtocol(DIST_DIR);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  store?.stopAutoSave();
  store?.flushNow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

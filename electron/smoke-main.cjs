const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");

// 用仓库内可写目录做 profile，避免受限环境里 %APPDATA% 不可写
const profile = path.join(__dirname, "..", ".electron-userdata");
fs.mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);

process.env.BLUEMAP_HEADLESS = "1";
// 把 30 秒自动保存压到 400ms，冒烟里能验证到
process.env.BLUEMAP_AUTOSAVE_MS = "400";

// 加载真实入口：协议、窗口、存储 IPC 全都走生产路径
require("./main.cjs");

const DATA_FILE = path.join(profile, "bluemap.json");

app.whenReady().then(async () => {
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const windows = BrowserWindow.getAllWindows();
  const win = windows[0];

  const ui = win
    ? await win.webContents.executeJavaScript(
        `({
           title: document.title,
           nodes: document.querySelectorAll(".react-flow__node").length,
           tabs: document.querySelectorAll(".ant-segmented-item").length,
           canvas: !!document.querySelector(".react-flow__pane"),
           storeBridge: typeof window.bluemap?.store?.write === "function",
           banner: document.body.innerText.includes("无法写入本地"),
         })`,
      )
    : { nodes: 0, tabs: 0, canvas: false, storeBridge: false, banner: true };

  // 等自动保存跑过至少一轮
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const autoSave = await win.webContents.executeJavaScript(
    "window.bluemap.store.info().then((i) => i.autoSave)",
  );

  // 触发一次落盘，确认数据真的写到了磁盘
  if (win) {
    await win.webContents.executeJavaScript("window.bluemap.store.flush()");
  }
  await new Promise((resolve) => setTimeout(resolve, 400));

  let dataOk = false;
  let blueprintCount = 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    blueprintCount = Object.keys(parsed.blueprints ?? {}).length;
    dataOk = blueprintCount > 0 && Object.keys(parsed.progress ?? {}).length > 0;
  } catch (error) {
    console.log("DATA_READ_FAILED", String(error.message));
  }

  const result = {
    ...ui,
    windows: windows.length,
    blueprintCount,
    dataFile: dataOk,
    autoSaveCount: autoSave?.count ?? 0,
    autoSaveIntervalMs: autoSave?.intervalMs ?? 0,
  };
  console.log("SMOKE", JSON.stringify(result));

  const ok =
    ui.nodes > 0 &&
    ui.tabs > 0 &&
    ui.canvas &&
    ui.storeBridge &&
    !ui.banner &&
    dataOk &&
    (autoSave?.count ?? 0) >= 1 &&
    autoSave?.intervalMs === 400;
  app.exit(ok ? 0 : 1);
});

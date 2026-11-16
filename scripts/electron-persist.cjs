const path = require("node:path");
const fs = require("node:fs");
const { _electron: electron } = require("playwright");

/**
 * Electron 持久化验证：
 *   1. 用干净的 profile 启动真实应用
 *   2. 在界面里把 emb-gpio 的掌握度改成 4
 *   3. 关闭应用（触发 before-quit → flush）
 *   4. 检查 bluemap.json 里是否正确写入
 *   5. 重新启动，确认界面读回来的是 4
 */
const ROOT = path.join(__dirname, "..");
const PROFILE = path.join(ROOT, ".electron-persist-test");
const DATA = path.join(PROFILE, "bluemap.json");

function readData() {
  return JSON.parse(fs.readFileSync(DATA, "utf8"));
}

async function launch() {
  const app = await electron.launch({
    args: ["--no-sandbox", `--user-data-dir=${PROFILE}`, "."],
    cwd: ROOT,
    env: { ...process.env, BLUEMAP_HEADLESS: "1", ELECTRON_DISABLE_SECURITY_WARNINGS: "1" },
  });
  const win = await app.firstWindow();
  await win.waitForSelector(".react-flow__node", { timeout: 30000 });
  return { app, win };
}

(async () => {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(PROFILE, { recursive: true });

  // ---- 第一次启动：改一笔数据 ----
  let { app, win } = await launch();

  await win.click('.react-flow__node[data-id="emb-gpio"]');
  await win.waitForSelector(".ant-drawer .ant-segmented-item", { timeout: 10000 });
  // 掌握度 0..5 的第 5 个 = 4
  await win.click(".ant-drawer .ant-segmented-item:nth-child(5)");
  // FAST=1 时模拟"改完立刻关窗口"，不等待防抖
  if (process.env.FAST !== "1") await win.waitForTimeout(900);

  const before = await win.evaluate(() => {
    const item = document.querySelector(".ant-drawer .ant-segmented-item-selected");
    return item ? item.textContent : null;
  });
  console.log("UI 选中项:", JSON.stringify(before));

  await app.close();
  await new Promise((r) => setTimeout(r, 600));

  const fileExists = fs.existsSync(DATA);
  const fromFile = fileExists ? readData().progress?.emb?.nodes?.["emb-gpio"]?.mastery : null;
  console.log("文件存在:", fileExists, " 落盘掌握度:", fromFile);

  // ---- 第二次启动：确认读回来 ----
  ({ app, win } = await launch());
  await win.click('.react-flow__node[data-id="emb-gpio"]');
  await win.waitForSelector(".ant-drawer .ant-segmented-item", { timeout: 10000 });
  const after = await win.evaluate(() => {
    const item = document.querySelector(".ant-drawer .ant-segmented-item-selected");
    return item ? item.textContent : null;
  });
  const nodeClass = await win.evaluate(
    () => document.querySelector('.react-flow__node[data-id="emb-gpio"] .bm-node')?.className ?? "",
  );
  console.log("重启后选中项:", JSON.stringify(after), " 节点类:", nodeClass);
  await app.close();

  const ok = fromFile === 4 && (after ?? "").includes("4");
  console.log(ok ? "PERSIST_OK" : "PERSIST_FAILED");
  process.exit(ok ? 0 : 1);
})().catch((error) => {
  console.error("PERSIST_ERROR", error);
  process.exit(1);
});

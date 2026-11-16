const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const electronPath = require("electron");

/**
 * 启动器，解决两个只在部分环境出现、但会让 Electron「开不起来」的问题：
 *
 * 1. 数据目录不可写。Chromium 的 profile 建不出来时会直接退出（exit 0），
 *    看起来像"闪退"。所以先挑一个确定可写的目录，用 --user-data-dir 显式指定。
 * 2. Chromium 沙箱初始化失败。退出码 0x80000003（Windows 上显示为
 *    2147483651 / -2147483645），崩在 JS 之前，主进程里 appendSwitch 救不回来，
 *    只能带 --no-sandbox 重启子进程。
 *
 * 正常机器上：走 %APPDATA%\BlueMap + 沙箱，不会看到任何警告。
 */
const SANDBOX_CRASH_CODES = new Set([2147483651, -2147483645, 0x80000003]);

function firstWritableDir(candidates) {
  for (const dir of candidates) {
    if (!dir) continue;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // 下一个
    }
  }
  return null;
}

const appData = process.env.APPDATA || null;
const home = os.homedir();

// 与主进程保持同一套候选目录；**不用 %TEMP% 或 cwd**，它们会让数据"看起来丢了"
const localAppData = process.env.LOCALAPPDATA || null;
const userDataDir = firstWritableDir([
  appData ? path.join(appData, "BlueMap") : null,
  localAppData ? path.join(localAppData, "BlueMap") : null,
  home ? path.join(home, ".bluemap") : null,
]);

if (!userDataDir) {
  console.warn("[bluemap] 找不到可写的数据目录，存储可能不可用");
}
if (userDataDir) {
  console.log("[bluemap] 数据目录:", userDataDir);
  if (!appData || !userDataDir.startsWith(appData)) {
    console.warn("[bluemap] %APPDATA% 不可写，数据改存到上面这个目录（每次启动都一样）");
  }
}

function launch(extraArgs) {
  const args = [...extraArgs];
  if (userDataDir) args.push(`--user-data-dir=${userDataDir}`);
  args.push(".");
  return spawn(electronPath, args, { stdio: "inherit", env: process.env });
}

const first = launch([]);

first.on("exit", (code, signal) => {
  if (signal || code === 0 || code === null) {
    process.exit(code ?? 0);
    return;
  }
  if (!SANDBOX_CRASH_CODES.has(code)) {
    process.exit(code);
    return;
  }

  console.warn(
    "\n[bluemap] Chromium 沙箱在这个环境里初始化失败，改用 --no-sandbox 重启。\n" +
      "          正常桌面环境不会出现；若你在这里看到，多半是提权终端或杀软拦截。\n",
  );

  const second = launch(["--no-sandbox"]);
  second.on("exit", (nextCode, nextSignal) => {
    process.exit(nextSignal ? 1 : (nextCode ?? 0));
  });
});

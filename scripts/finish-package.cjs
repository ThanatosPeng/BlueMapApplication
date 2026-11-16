const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * 打包后处理：
 *   1. 把真正的 Electron 主程序改名成 BlueMapCore.exe
 *   2. 编译 BlueMap 启动器（会自动处理沙箱崩溃）
 *   3. 精简语言包
 *   4. 打成 zip
 */
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "release", "BlueMap-win32-x64");
const CORE = path.join(OUT, "BlueMapCore.exe");
const LAUNCHER = path.join(OUT, "BlueMap.exe");
const SOURCE = path.join(ROOT, "electron", "launcher.cs");

function findCsc() {
  const candidates = [
    path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    path.join(process.env.WINDIR || "C:\\Windows", "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
  ];
  return candidates.find((file) => fs.existsSync(file));
}

if (!fs.existsSync(CORE) && fs.existsSync(LAUNCHER)) {
  fs.renameSync(LAUNCHER, CORE);
  console.log("renamed electron binary → BlueMapCore.exe");
}

const csc = findCsc();
if (!csc) {
  console.error("找不到 csc.exe（.NET Framework 4.x），跳过启动器编译");
  process.exit(1);
}

execFileSync(csc, ["/nologo", "/target:winexe", `/out:${LAUNCHER}`, SOURCE], { stdio: "inherit" });
console.log("launcher built:", path.relative(ROOT, LAUNCHER));

// 清掉运行期产物（测试跑过会留下 .bluemap-userdata，里面是 Chromium 的锁文件）
for (const junk of [".bluemap-userdata", ".electron-userdata", "data", ".write-probe"]) {
  fs.rmSync(path.join(OUT, junk), { recursive: true, force: true });
}

const locales = path.join(OUT, "locales");
if (fs.existsSync(locales)) {
  for (const file of fs.readdirSync(locales)) {
    if (!["en-US.pak", "zh-CN.pak"].includes(file)) {
      fs.rmSync(path.join(locales, file), { force: true });
    }
  }
}

const zip = path.join(ROOT, "release", "BlueMap-win32-x64.zip");
fs.rmSync(zip, { force: true });
execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${OUT}', '${zip}', [System.IO.Compression.CompressionLevel]::Optimal, $true)`,
  ],
  { stdio: "inherit" },
);
console.log("zip:", path.relative(ROOT, zip), `${(fs.statSync(zip).size / 1024 / 1024).toFixed(1)} MB`);

const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * 打包入口。
 *
 * electron-packager 在 Windows 上收尾时会因为临时目录删除失败报 ENOTEMPTY
 * （产物其实已经生成），所以这里不把它的退出码当成失败，只看产物在不在。
 */
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "release", "BlueMap-win32-x64");

const args = [
  "electron-packager",
  ".",
  "BlueMap",
  "--platform=win32",
  "--arch=x64",
  "--out=release",
  "--overwrite",
  "--asar",
  "--app-version=0.1.0",
  "--ignore=^/node_modules",
  "--ignore=^/src",
  "--ignore=^/e2e",
  "--ignore=^/scripts",
  "--ignore=^/docs",
  "--ignore=^/prototype",
  "--ignore=^/release",
  "--ignore=^/test-results",
  "--ignore=^/playwright-report",
  "--ignore=^/\\.electron",
  "--ignore=^/\\.bluemap",
  "--ignore=^/\\.dsh",
  "--ignore=^/\\.pack",
  "--ignore=^/data",
  "--ignore=^/\\.skill-docs",
  "--ignore=^/\\.git",
];

try {
  execSync(["npx", ...args].join(" "), { cwd: ROOT, stdio: "inherit", shell: true });
} catch (error) {
  console.warn("[pack] packager 退出码非 0（Windows 收尾清理常见），继续检查产物");
}

const exe = fs.existsSync(path.join(OUT, "BlueMapCore.exe"))
  ? path.join(OUT, "BlueMapCore.exe")
  : path.join(OUT, "BlueMap.exe");

if (!fs.existsSync(exe)) {
  console.error("[pack] 没找到电子主程序，打包失败");
  process.exit(1);
}

execFileSync(process.execPath, [path.join(__dirname, "finish-package.cjs")], {
  cwd: ROOT,
  stdio: "inherit",
});

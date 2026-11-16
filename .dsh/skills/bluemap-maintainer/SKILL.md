---
name: bluemap-maintainer
description: Maintain BlueMap (Vite + React + Ant Design + React Flow + Electron 学习蓝图应用). Use when editing code, running tests/E2E, debugging persistence, or rebuilding the Windows exe in this repository.
whenToUse: 任务发生在本仓库（BlueMap）内 —— 改功能、跑测试、排查存储/打包问题时先加载本 skill。
---

# BlueMap 维护手册

这个仓库有自己的硬约束，凭通用经验容易踩坑。动手前先读完。

## 环境

- **Node 必须 v20.20.2**（`nvm use 20.20.2`）。终端重启后 nvm 会退回 18，表现为 `styleText` / Vite 版本错误。
- 依赖装法：`npm install --legacy-peer-deps`。
- `npm test` 在 Node 20 上**失败用例会打印不出来**（vitest 5 用了 `Map.groupBy`，报错格式化崩掉）。要看真实失败信息，临时切 Node 22 跑一次。

## 常用命令

```bash
npm test                 # vitest，领域/仓库/store 单测
npm run typecheck        # tsc --noEmit，必须 0 错误
npm run build            # vite build
npx playwright test      # E2E，11+ 条，走系统 Edge（channel: msedge）
npm run electron:smoke   # 无头验证 Electron：渲染 21 节点 + 文件存储 + 自动保存
npm run package:win      # 出 release/BlueMap-win32-x64/BlueMap.exe
```

**不要** `npx playwright install chromium`：本机下载会卡死；配置里已固定系统 Edge。

## 分层纪律

- `src/domain/` 必须是纯函数，且 100% 有单测；改它之前先跑 `npm test`。
- 组件只做编排，算法进 domain。
- store 的 initial state 里每个 key **只能出现一次**（重复会报 TS1117）。

## 已定型的业务规则（改动前先确认不是倒退）

- **掌握度来源只有两类**：AI 问答分数、作品/仓库的 AI 评估分数；两者兼有取较小值。旧的「自评/测验/产出物/AI 追问」四项勾选已废弃（字段保留仅为兼容旧数据），**不要把它加回 UI**。
- **容器节点**（挂了子蓝图的父节点）在画布与抽屉里只显示子图进度，**不显示掌握度与证据**；子图全部 mastery≥4 时父节点自动点亮（`autoCompleted`），手动改掌握度会清掉该标记。
- 跨蓝图关联是**提示性**的，不参与解锁。

## Electron 与存储（最容易被误判的部分）

- 打包产物用 `app://bluemap` 自定义协议加载，**绝不能用 `file://`** —— Chromium 会禁用 IndexedDB。
- 数据目录优先级：**已存在 `bluemap.json` 的目录优先**（避免换启动方式读到空库）→ `%LOCALAPPDATA%\BlueMap` → `%APPDATA%\BlueMap` → `~/.bluemap` → 文档 → 程序目录 `data\`（便携兜底）。诊断入口：应用内 `Ctrl+K → 存储诊断`，日志在同目录 `bluemap.log`。
- 写入策略：改动即写 + 启动保存一次 + **每 10 秒**全量兜底 + 关窗前 flush。
- 「已保存」只代表 IPC 返回；真正落盘由主进程同步写，失败会回传成「保存失败」。
- **双击闪退（退出码 `2147483651` / `0x80000003`）是 Chromium 沙箱初始化失败**，崩在 JS 之前，应用内无法自救；由 5KB 的 C# 启动器 `electron/launcher.cs` 负责带 `--no-sandbox` 重试。`BlueMap.exe` = 启动器，`BlueMapCore.exe` = Electron 本体。
- 环境里有 `ELECTRON_RUN_AS_NODE=1` 时 Electron 会退化成纯 Node（`app` undefined），先清掉该变量。

## 顶栏布局（踩过）

蓝图 tab 变多时，顶栏会挤压右侧控件：`Lv.3` 曾被压成 7px 宽、逐字换行成 240px 竖条，
从 60px 高的 header 溢出到画布上，表现为「背景出现零散数字字母」。
规则：header 必须 `overflow: hidden`；顶栏内文字/按钮 `flex: none; white-space: nowrap`；
蓝图 tab 放在可横向滚动的 `.bm-tabs` 里，优先压缩它而不是挤别的控件。

## 验证习惯

- 改 UI 后用 Playwright 断言真实行为，不要只截图。
- 量 antd Drawer 宽度前要等滑入动画（`waitForTimeout(400)`），否则量到动画中途。
- 关掉的 Drawer 容器仍在 DOM 里，断言「内容消失」而不是「元素隐藏」。
- 涉及文件存储的改动，跑 `scripts/electron-persist.cjs`（改数据 → 关闭 → 读 JSON → 重启 → 读回）。

## 文档

`DESIGN.md`（设计真源）、`PROGRESS.md`（进度与坑）、`TECH-STACK.md`（依赖与反模式）。改了行为就同步文档，尤其是 DESIGN §5 的机制与 §13 的实现现状。

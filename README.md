# BlueMap · 学习蓝图

把"学到哪了、下一步学什么、到底算不算会了"变成一张可点亮、可解释、可修正的星图。

> 当前状态：**M1–M3 主体完成**，可作为桌面应用运行（Electron 41）。开发进度、已知问题见 [`PROGRESS.md`](PROGRESS.md)，实现与设计的差异见 [`DESIGN.md`](DESIGN.md) §13。

## 快速开始

```bash
nvm use 20.20.2          # 需要 Node ≥ 20.19，默认的 v18 跑不动 Vite 8
npm install --legacy-peer-deps
npm run dev              # 浏览器：http://localhost:5178/
```

```bash
npm run electron:dev     # 桌面窗口 + Vite 热更新
npm run electron:start   # 先构建再开窗口（等同发布形态）
npm run electron:smoke   # 无头冒烟：加载构建产物，断言渲染 / 桥 / IndexedDB
```

> 启动都走 `electron/dev-launch.cjs`。它会先探测可写的数据目录，再用正常的沙箱参数启动；
> 只有当 Chromium 沙箱初始化失败（退出码 `0x80000003`）时，才自动带 `--no-sandbox` 重试并打印一行警告。
> 正常桌面环境不会看到任何警告。

```bash
npm test                 # 领域逻辑单测
npx playwright test      # 端到端（走系统 Edge）
npm run build            # 生产构建
npm run package:win      # 打 Windows 免安装包 → release/BlueMap-win32-x64/BlueMap.exe
```

## 目录

| 路径 | 内容 |
| --- | --- |
| [`PROGRESS.md`](PROGRESS.md) | **开发进度与交接**：已完成 / 已知问题 / 下一步顺序 |
| [`DESIGN.md`](DESIGN.md) | 完整设计方案：需求、功能补全、机制、数据模型、架构、排期、风险 |
| [`TECH-STACK.md`](TECH-STACK.md) | 技术栈落地清单：依赖、装配顺序、组件速查、反模式检查表 |
| `src/` | 正式工程源码（按 `domain / graph / features / persist / store` 分层） |
| `electron/` | 桌面壳：`main.cjs`（窗口 + AI IPC）、`preload.cjs`（最小桥）、`protocol.cjs`（`app://` 协议）、`smoke.cjs`（无头冒烟） |
| [`prototype/index.html`](prototype/index.html) | 交互原型，**零依赖双击即开**，作为手感基准保留 |
| [`docs/shot-app.png`](docs/shot-app.png) | 正式工程当前界面截图 |
| `prototype/shot-*.png` | 原型截图（嵌入式 / Vue / React / 详情 / 复习 / AI） |

## 内置蓝图

| 蓝图 | 目标 | 节点 |
| --- | --- | --- |
| 嵌入式 | 能独立交付一块带 RTOS 的量产级板子 | 21 |
| 前端 Vue | 能独立开发并维护一个 Vue 3 产品 | 20 |
| 前端 React | 能独立开发并维护一个 React 产品 | 19 |
| 软件工程 | 能独立交付一个上线产品（通用地基） | 27 |

每张蓝图独立成树、可单独维护。节点粒度按"能独立做出来"划分，不是按章节划分。

## 打开原型

直接双击 `prototype/index.html`，或拖进浏览器。无需安装、无需服务器。

数据存在浏览器本机（`localStorage`），关掉再开还在；左下角"重置演示数据"可清空。

### 可以试的操作

| 操作 | 说明 |
| --- | --- |
| 拖拽空白处 / 滚轮 | 平移 / 缩放（以光标为中心） |
| 点节点 | 右侧滑出详情：掌握度、证据、依赖、笔记、资源、复习 |
| 改「掌握度」到 4+ | 节点点亮、下游解锁、弹出涟漪与提示 |
| 点「按证据计算」 | 用自评/测验/产出/AI 四类证据加权算掌握度 |
| 左侧「开始复习」 | 翻卡自评（忘记/模糊/记得），间隔按 SM-2 调整 |
| 左侧「打开 AI 规划」 | 先给三条本地规则建议；配好 Key 后可让 DeepSeek 基于图谱再给一轮 |
| 右上角 ⚙ | 填 DeepSeek 的 Base URL / 模型 / API Key（只存本机），可「测试连接」 |
| 顶部切换蓝图 | 嵌入式 / 前端 Vue / 前端 React / 软件工程 |
| 按 `E` 进编辑模式 | 拖动节点改位置（自动记忆）、删除节点 |
| `F` 适配视图 · `/` 搜索 · `N` 新建节点 | 快捷键 |

> 原型自检：打开 `prototype/index.html?selftest=1`，左上角显示 44 项逻辑断言结果。
> 调试参数：`?bp=emb|vue|react|se`（切换蓝图）、`?node=sysdesign`（直接开节点详情）、`?modal=ai|review|settings`。

## 设计要点（30 秒版）

1. **树是地图不是牢笼** —— 默认按序推荐，但永远允许越级，只标记"地基未稳"。
2. **点亮必须有证据** —— 掌握度 0–5 级，四类证据加权，手动覆盖要留痕。
3. **树会长** —— 蓝图是可编辑资产，随时拆节点、改依赖、导出去。

最容易踩的坑是把 XP 绑在"点击完成"上——那会让人学会点按钮。本系统里 XP 只由掌握度与里程碑产生，和在线时长、打卡天数完全解耦。

## 桌面端

- **加载方式**：构建产物通过自定义协议 `app://bluemap/index.html` 加载，**不是 `file://`**。`file://` 是 opaque origin，Chromium 会禁用 IndexedDB，本地存储会静默降级成内存。
- **AI 请求**：渲染进程调用 `window.bluemap.aiRequest`，主进程用 `net.fetch` 直连 DeepSeek，因此不需要 Vite 代理，也没有 CORS。浏览器里仍走 `/api/deepseek` 代理。
- **安全**：`contextIsolation: true`、`nodeIntegration: false`，preload 只暴露一个 `aiRequest`；外链一律交给系统浏览器。
- **存储降级链**：桌面端写 `bluemap.json`；浏览器优先 IndexedDB，**不可用时自动退回 localStorage 持久化**（不再直接退到内存）。左下角会显示当前存储方式，一眼能看出有没有真的存下来。
- **数据位置**：`<userData>/bluemap.json`（通常 `%APPDATA%/BlueMap/bluemap.json`）。数据在内存里跑，主进程 250ms 防抖落盘，退出前强制写一次。**不用 IndexedDB**——它在某些 Electron 环境下会静默失效。冒烟脚本为了在受限环境可跑，会把 `userData` 指到仓库内的 `.electron-userdata/`（已 gitignore）。

### 打包版（exe）

```bash
npm run package:win     # → release/BlueMap-win32-x64/BlueMap.exe
```

- `BlueMap.exe` 是 **5KB 的启动器**，`BlueMapCore.exe` 才是 Electron 本体；
- 启动器先按正常参数拉起 Core，若它 2.5 秒内退出（Chromium 沙箱初始化崩溃，退出码 `0x80000003`），会写标记并改用 `--no-sandbox` 重启，之后每次都直接带该参数；
- 数据目录优先级：`%LOCALAPPDATA%\BlueMap` → `%APPDATA%\BlueMap` → `~/.bluemap` → 文档 → **程序目录 `data\`**（便携模式）。设置不生效时看 `Ctrl+K → 存储诊断` 里的「数据文件」；
- 首次运行会弹 SmartScreen（无代码签名），点「更多信息 → 仍要运行」。

### 启动失败排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 退出码 `2147483651` / `-2147483645`，没有任何输出 | Chromium 沙箱初始化失败（崩在 JS 之前） | 启动器会自动带 `--no-sandbox` 重试；仍失败就换普通（非提权）终端 |
| 窗口一闪而过、退出码 0 | 数据目录不可写，Chromium 建不出 profile | 启动器会自动换 `%USERPROFILE%\.bluemap` 或仓库内 `.bluemap-userdata`，并打印一行提示 |
| `app is undefined` 之类 | 环境里有 `ELECTRON_RUN_AS_NODE=1`，Electron 退化成纯 Node | 先 `Remove-Item Env:ELECTRON_RUN_AS_NODE`（PowerShell）或 `set ELECTRON_RUN_AS_NODE=`（cmd） |

## 下一步

已做：蓝图/节点编辑、掌握度与证据、SM-2 复习、AI 拆解（产出子蓝图）、时间轴回放、成就、移动端只读、跨蓝图关联、蓝图层级与父子回链、Electron 桌面壳。

未做：安装包（`electron-builder` 尚未接入）、多设备同步、整图 AI 生成向导、复习日历热力图、大图 WebGL。详见 [`PROGRESS.md`](PROGRESS.md) 第四节的 backlog。

## 已知的原型限制

- **AI 是真接 DeepSeek 的**，但浏览器直连会被 CORS 拦（`file://` 页面尤其如此）。面板、配置、错误提示都已完成，正式版走 `/api/deepseek` 代理即可，见 [`TECH-STACK.md`](TECH-STACK.md) §2。
- 连线（拖拽建立依赖）只在设计方案里，原型只支持拖动位置与删除节点。
- **原型里的 SVG 画布、拖拽、缩放、Toast 都是手写的**——它是一次性验证件。正式工程按 [`TECH-STACK.md`](TECH-STACK.md) 换成 React Flow + Ant Design，这些代码不会带进 M1。
- 不能新建/删除蓝图；数据存在 localStorage，清缓存会丢。
- 移动端未适配（设计上只做只读 + 复习）。

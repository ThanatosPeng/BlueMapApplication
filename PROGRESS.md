# PROGRESS · 开发交接

> **给下一个会话的第一句话**：读 [`DESIGN.md`](DESIGN.md) 第 9 章 + [`TECH-STACK.md`](TECH-STACK.md) + 本文件，然后从「下一步」第 1 条继续。不要重新规划，也不要改技术选型。

更新时间：2026-11-13

## 一、环境前置（重要）

| 项 | 值 |
| --- | --- |
| Node | **v20.20.2**（`nvm use 20.20.2`）。默认的 v18 跑不动 Vite 8；v16 也不在支持范围。**终端重启后 nvm 会退回 18**，报 `styleText` / Vite 版本错时先切回来 |
| 包管理 | npm 10.8.2 |
| 安装命令 | `npm install --legacy-peer-deps`（`ai` / `@ai-sdk/openai` 声明了 `engines: node>=22`，直接装会报 EBADENGINE 并让 npm 退出码非 0） |
| 启动 | `npm run dev` → http://localhost:5178/ （Vite 只监听 IPv6，用 `localhost`，`127.0.0.1` 连不上） |
| 构建 | `npm run build`（约 400ms；已 vendor 分包，业务包 82KB / gzip 30KB） |
| 单测 | `npm test`（Vitest，76 个用例） |
| E2E | `npx playwright test`（11 个用例）。**用系统 Edge，不下载 Chromium**：`playwright.config.ts` 里 `channel: "msedge"`。本机 `npx playwright install chromium` 会卡死在下载，别重试 |
| 桌面端 | `npm run electron:start`（构建后直接开窗口）或 `npm run electron:dev`（Vite 热更新 + 窗口）。打包产物用 `app://` 协议加载，不是 `file://` |
| Electron 的坑 ① | 环境里若存在 `ELECTRON_RUN_AS_NODE=1`，Electron 会退化成纯 Node（`app` 为 undefined），先 `Remove-Item Env:ELECTRON_RUN_AS_NODE` |
| Electron 的坑 ② | 沙箱初始化失败 = 退出码 `2147483651`（`0x80000003`），崩在 JS 之前，只能靠启动器带 `--no-sandbox` 重启；`electron/dev-launch.cjs` 已自动处理 |
| Electron 的坑 ③ | 默认 userData 不可写时 Chromium 直接退出（码 0），表现为"闪退"；启动器会用 `--user-data-dir` 指定可写目录 |
| 数据文件 | 桌面端数据在 `<userData>/bluemap.json`；删掉它会重新补种四张内置蓝图。格式校验用 `node -e`，别用 PowerShell 的 `ConvertFrom-Json`（它按 ANSI 读，中文会报 JSON 无效） |

## 二、已完成（M1 骨架 + M2 三项 + 体验打磨 + E2E）

**能跑起来的东西**：四张蓝图、星图渲染、节点详情抽屉、掌握度与证据、dagre 自动布局、撤销/重做、IndexedDB 持久化 + 内存兜底。

| 模块 | 文件 | 状态 |
| --- | --- | --- |
| 蓝图种子数据 | `src/data/blueprints.json` + `src/data/index.ts` | ✅ 4 张（emb 21 / vue 20 / react 19 / se 27 节点），由 `scripts/extract-blueprints.mjs` 从原型抽取生成 |
| 领域类型 | `src/domain/types.ts` | ✅ 节点/边/进度/证据，与 DESIGN §6 对齐 |
| 图算法 | `src/domain/graph.ts` | ✅ 前置/后继/下游计数/环检测/连线合法性/拓扑序 |
| 掌握度与解锁 | `src/domain/mastery.ts` | ✅ 五状态推导、证据加权、XP、等级 |
| 复习排程 | `src/domain/scheduler.ts` | ✅ SM-2 简化版（尚未接 UI） |
| 推荐 | `src/domain/recommend.ts` | ✅ 可解释理由模板 |
| 布局 | `src/domain/layout.ts` | ✅ dagre LR，返回左上角坐标 |
| 持久化 | `src/persist/{db,seed,repo}.ts` | ✅ Dexie 三张表 + 4s 超时降级到内存仓库 |
| 状态 | `src/store/useAppStore.ts` | ✅ zustand + immer + zundo（撤销栈 60 步） |
| 画布 | `src/graph/{BlueprintNode,Canvas}.tsx` | ✅ React Flow 12，自定义节点、贝塞尔边、自动布局、连线校验、建节点、Delete 删除 |
| 编辑器 | `src/domain/edit.ts` + `src/store/useAppStore.ts` | ✅ 增删节点、连线（自连/重复/成环全部拦截）、删节点连带删边、结构级撤销 |
| 复习 | `src/features/ReviewDrawer.tsx` + store.review | ✅ 到期卡片、忘记/模糊/记得三键、SM-2 落库、保持率小结 |
| AI 接入 | `src/ai/{provider,deepseek}.ts` + `src/features/AICoach.tsx` | ✅ DeepSeek（走 `/api/deepseek` 代理）、Key 存 settings、未配置时静默降级、错误人话提示 |
| 导出/导入 | `src/domain/serialize.ts` + 顶栏按钮 | ✅ 整库 JSON、zod 校验、悬空依赖/环检测、**不含 AI Key** |
| 蓝图生命周期 | store `createBlueprint` / `deleteBlueprint` + 顶栏 | ✅ 新建（空图）、删除（连带 progress，二次确认）、空态引导 |
| 搜索定位 | 顶栏 `AutoComplete` + `focusNodeId` | ✅ 选中并 `fitView` 聚焦到节点 |
| 快捷键 + 命令面板 | `react-hotkeys-hook` + `cmdk` + antd Modal | ✅ `Ctrl+K` 面板、`Ctrl+Z` / `Ctrl+Shift+Z`、`/` 聚焦搜索；命令含切蓝图/新建节点/自动布局/导出/复习/定位节点 |
| 深链 | URL 参数 | ✅ `?bp=vue`、`?node=emb-rtos`、`?palette=1`、`?expand=demo`（后两个调试用） |
| AI 拆节点 | `src/ai/expand.ts` + `src/features/ExpandModal.tsx` | ✅ 提示词 + 容错解析（fence/夹带文本）+ zod 校验；草稿勾选后才写库，自动连到父节点下 |
| 复盘统计 | `src/domain/stats.ts` + `src/features/StatsDrawer.tsx` | ✅ 已掌握/近 7 天点亮/复习到期/剩余工时、状态分布、卡住的节点、按层进度 |
| 体验打磨 | Canvas / Vite 配置 | ✅ 选中节点时高亮相连边、MiniMap 修复、空蓝图提示、vendor 分包（业务包 82KB） |
| 节点属性编辑 | `Inspector` + store `updateNodeField` | ✅ 详情面板直接改标题/说明/类型/工时（点标题旁的铅笔），可撤销 |
| E2E | `e2e/app.spec.ts` + `playwright.config.ts` | ✅ 6 条：启动渲染 / 抽屉改掌握度 / 新建蓝图 / Ctrl+K / 拖线建依赖 / 撤销重做 |
| 成就（M3） | `src/domain/achievements.ts` + 复盘面板 | ✅ 6 个徽章由快照推导（第一盏灯/十盏灯/过半/地基完工/里程碑/一周三连），不存表 |
| 时间轴（M3） | `src/domain/timeline.ts` + `TimelineBar` + Canvas 回放态 | ✅ 按 `litAt` 重放点亮过程；未点亮的节点在回放中压成锁定态；支持播放/拖动/日期提示 |
| 移动端只读（M3） | `ui/useIsNarrow` + 窄屏分支 | ✅ <860px 隐藏左栏/搜索/导出/新建，顶部换 Select + 图标按钮；禁止拖拽/连线/删除/改属性；抽屉满宽 |
| 跨蓝图关联（v2） | `domain/links.ts` + `CrossLinkModal` + Inspector/Canvas | ✅ 节点间可建「提示性」关联（不参与解锁）；抽屉里双向列出、可跳转/删除；画布节点显示 `⇄n` 角标 |
| 蓝图层级（v2） | `Blueprint.parentId` + 顶栏两级切换 | ✅ 顶栏只列顶层蓝图，子蓝图收在下拉里（「总览」回父级） |
| 父节点回链（v2） | `ParentRefNode` + `parentLinkFor` | ✅ 子蓝图顶部合成只读「父蓝图节点」（虚线金框 + 标签），点击回父蓝图并打开该节点详情；画布顶部还有「← 父蓝图」按钮 |
| 节点删除 | Inspector「危险操作」+ store.deleteNode | ✅ 抽屉里可删（Popconfirm 提示会断开几条依赖）；级联清掉指向它的跨蓝图关联；窄屏隐藏（只读） |
| **Electron 桌面壳** | `electron/{main,preload,protocol,store,dev-launch,smoke-main}.cjs` | ✅ Electron 41；`app://` 自定义协议加载 dist（`file://` 会禁用 IndexedDB）；AI 请求经 IPC 由主进程 `net.fetch`；有冒烟脚本 |
| **本地 JSON 存储（桌面端）** | `electron/store.cjs` + `src/persist/fileRepo.ts` | ✅ 数据常驻主进程内存，250ms 防抖原子写 `userData/bluemap.json`；启动读一次；不再依赖 IndexedDB |
| **父节点两种形态** | `domain/childProgress.ts` + Canvas/BlueprintNode | ✅ 挂子图的节点卡片显示「子蓝图 · 3/3 完成 · 100%」+ 子节点标题与各自掌握度；未挂的仍显示简介/掌握度/证据/资料 |
| **子图全亮自动完成** | `applyAutoCompletion`（store） | ✅ 打开/回到父蓝图时结算：子图所有节点 mastery≥4 → 父节点自动点亮并标 `autoCompleted`；手动改掌握度会清掉该标记 |
| **AI 问答定掌握度** | `ai/quiz.ts` + `QuizModal` + store | ✅ AI 出 3 道递进题 → 作答 → 判分；题目/回答/点评存进 `NodeState.aiQuiz`，抽屉里可展开回看 |
| **作品/仓库 AI 评估** | `ai/artifactReview.ts` + `ArtifactModal` | ✅ 关联作品可贴 README/关键代码 → 点「评估」由 AI 打分并给点评，结果存进 `ArtifactRef.review` |
| **旧证据勾选已移除** | Inspector / store | ✅ 自评/测验/产出物/AI 追问 四项勾选与「按证据折算」整段删除；`Evidence` 字段保留仅为兼容旧数据 |
| 掌握度合成规则 | `combineScores`（store） | ✅ AI 问答分与作品分取较小值；都没有才用手动值 |
| 存储降级链 | `src/persist/repo.ts` | ✅ Electron 文件 → 浏览器 IndexedDB → **localStorage（持久化）** → 内存；界面左下角显示当前存储（`数据：本地文件 bluemap.json` 等） |
| **Windows 打包** | `npm run package:win`（`scripts/pack.cjs` + `finish-package.cjs`） | ✅ 免安装包：`BlueMap.exe`（5KB 启动器）+ `BlueMapCore.exe`（Electron 本体）；启动器负责沙箱崩溃兜底；zip 约 125MB |\n| **双击闪退修复** | `electron/launcher.cs` | ✅ 打包后没有启动器加参数，Chromium 沙箱崩（`2147483651`）会闪退且崩在 JS 之前，应用内无法自救。改为外部启动器：先正常启动，2.5s 内退出则写 `sandbox-unsupported` 标记并带 `--no-sandbox` 重启 |\n| 持久化端到端验证 | `scripts/electron-persist.cjs` | ✅ Playwright 驱动真实 Electron：改掌握度 → 关闭 → 读 JSON → 重启 → 界面恢复，`PERSIST_OK`；`FAST=1` 模拟改完立刻关，同样通过 |
| 关窗兜底 + 诊断 | `flushSaves()` / `store:info` / 命令面板「存储诊断」 | ✅ 关窗前主进程等渲染进程把防抖中的保存发完（≤600ms）；左下角显示「已保存 HH:mm:ss」；⌘K → 存储诊断 可看文件路径、写入次数、最近落盘时间、启动时文件状态 |
| **启动即存 + 10 秒自动保存** | `electron/store.cjs`（`startAutoSave`） | ✅ 加载 `bluemap.json` 后立刻整份写一次；之后每 10 秒全量落盘兜底；退出时停止定时器并 flush；间隔可用 `BLUEMAP_AUTOSAVE_MS` 覆盖（测试用），存储诊断里能看到次数与最近时间 |\n| **写入不再说谎** | `electron/store.cjs` | ✅ `write()` 同步落盘并把失败回传；失败时界面显示「保存失败」而不是「已保存」。数据目录用真实探针文件验证（`accessSync` 会骗人）。读坏的 JSON 先备份成 `bluemap.json.corrupt-<ts>` 再启动。每次启动/写入记到同目录 `bluemap.log` |
| AI 拆解产出子蓝图 | `store.createChildBlueprint` | ✅ 拆解结果生成独立子蓝图（parentId 指向父图）+ 一条指向父节点的蓝图级关联；自动切到子图 |
| 界面 | `src/features/{Rail,Inspector}.tsx`、`src/App.tsx` | ✅ 顶栏切换蓝图（`?bp=` 深链）/ 导出导入 / 搜索 / 左侧推荐复习 AI / 右侧抽屉 |
| 主题 | `src/ui/theme.ts` | ✅ AntD 6 暗色 token + 状态色常量 |

**验证记录**

- `npm test` → **107/107 通过**（领域 53 + AI 23 + store 集成 21 + 本地仓库 6 + localStorage 4）
- `npm run test:e2e` → **11/11 通过**，26.2s（含 390×844 只读、跨蓝图关联、AI 拆解出子蓝图、父节点回跳、删除节点）
- `npm run typecheck` → 通过（TS 7，零错误）
- `npm run build` → 成功，exit 0，业务包 82KB / gzip 30KB
- `docs/shot-stats.png` 复盘（含成就）、`docs/shot-timeline.png` 时间轴回放、`docs/shot-focus.png` 聚焦态

## 三、已知问题（按优先级）

> **已修复（2026-11-16）**：画布上出现零散的单个字符（5/3/0/X/P）。
> 根因不在画布，而在**顶栏**：蓝图 tab 变多后横向空间不足，`Lv.3` 那段文字被 flex 压到 7px 宽，
> 逐字换行成 240px 高的竖条；它在 60px 高的 header 里垂直居中后从 `y=-90` 溢出，
> 又因为 header `overflow: visible`，这些字被画到了画布上（看起来像"背景杂字"）。
> 修复：header `overflow: hidden`；顶栏内文字/按钮 `flex: none; white-space: nowrap`；
> 蓝图 tab 放进可横向滚动的 `.bm-tabs` 容器，优先压缩它而不是挤别的控件。
> 回归用例：「窄窗口下顶栏不会把控件挤成竖排」。
>
> 同时修了数据目录选择：**优先复用已存在 `bluemap.json` 的目录**，避免换启动方式后读到空库。


> **已修复（2026-11-15）**：重开应用后，挂了子蓝图的节点又显示成普通节点（有掌握度、证据）。
> 根因：初始化时序——`init()` 先 `open()` 后 `loadLinks()`，而 `open()` 里计算容器节点需要 `links`，
> 那时 links 还是空的 → `children` 为空 → 按原子节点渲染。切一次蓝图才会自愈。
> 修复：① `init` 先加载 links 再 open；② `loadLinks()` 完成后若已有打开中的蓝图，自动 `refreshChildren()`；
> ③ `open()` 里若 `linksLoaded` 仍为 false 就就地补加载。**与保存无关**，文件里数据一直是完整的。
> 回归用例：「重新打开应用后，容器节点仍按子蓝图显示」。


> **已修复（2026-11-15）**：桌面端"改了掌握度、重开还是旧值"。
> 根因：数据目录回退链里包含 `%TEMP%\bluemap-userdata` 和 `process.cwd()\.bluemap-userdata`。
> 当 `%APPDATA%\BlueMap` 不可写时，数据落到 TEMP（会被系统清理/变化）或 cwd（随启动方式变化），
> 每次启动都读到"文件不存在"→ 重新播种 → 看起来像没保存。
> 修复：只用稳定目录（`%APPDATA%` → `%LOCALAPPDATA%` → `~/.bluemap` → 文档），**移除 TEMP 与 cwd**；
> 用真实探针文件验证可写；写入改为同步落盘并把失败回传；首次启动自动迁移旧位置的数据；
> 每次启动/写入记录到 `bluemap.log`。

0. **打包产物**：`npm run package:win` 用 `@electron/packager` 生成 `release/BlueMap-win32-x64/BlueMap.exe`（免安装绿色版），压缩包在 `release/BlueMap-win32-x64.zip`（约 125MB）。没有做 NSIS 安装包，也没有代码签名——首次运行 Windows 会弹 SmartScreen「未知发布者」，点"更多信息 → 仍要运行"即可。

> **用户已真机确认（2026-11-13）**：① 刷新后数据仍在 ✅ ② 导出 JSON 能正常再导入 ✅ ③ AI 真机调用暂缓（Key 最后验）。这三条从"未验证"降级为"已验证"。

1. **AI 只在测试里验证过**。`fetch` 被 stub，真实 DeepSeek 调用留到最后由用户填 Key 验证；代理默认 `/api/deepseek`。
2. **vitest 5 要求 Node ≥ 22**，本机 Node 20 能跑通用例，但**断言失败时错误格式化器会崩**（`Map.groupBy is not a function`），排查失败原因时得临时换 Node 22。

> 已修：MiniMap 空白（节点缺 `width/height`，补上后正常）、选中时边压太暗（改成 0.6 透明度 + 相关边加粗）、主包过大（vendor 分包，业务代码 82KB / gzip 30KB）、**撤销无效**（`syncSummary` 往历史里塞了空快照，给 zundo 加 `equality` 比较 `doc/progress` 引用）、**连接点被裁**（`Handle` 原本在 `overflow:hidden` 的盒子里，移到盒外后拖线才可用）。副标题省略号经核查一直是好的，旧记录有误。

## 四、下一步（按这个顺序，别跳）

### 第 1 步：真实浏览器验收（需要你本人点，10 分钟）

1. 打开 http://localhost:5178/ → 改个掌握度 → 刷新，确认还在、无黄条；
2. 点「导出」拿到 JSON → 改点东西 → 点「导入」选刚才的文件，确认恢复；
3. 若有 DeepSeek Key，配置后点「让 DeepSeek 分析这张图」，确认能返回 3 条建议。

### 第 2 步：v2 backlog（按需）

- 多设备同步（DESIGN §9.10）；
- E2E 可继续补：导入导出真实文件往返、AI 拆节点预览（用 `?expand=demo`）；
- 大图性能：节点破 300 时再考虑虚拟化/WebGL。

> 提示：E2E 里量抽屉宽度要等滑入动画结束（`waitForTimeout(400)`），否则量到的是动画中途——这个坑已经踩过一次。

### 第 3 步：验收清单

对着 [`TECH-STACK.md`](TECH-STACK.md) §9 逐条打勾：**7/7 通过**（新建蓝图、拖动+撤销、环路拒绝、自动布局、导出导入、无手写交互组件、AI 降级）。持久化与导入导出已由用户真机确认；AI 真机调用待最后验。

## 五、交接约定

- **不要重写已通过测试的 `domain/`**，它是最贵的部分；改之前先跑 `npm test`。
- **不要引入第二个 UI 库**，也不要手写 Modal/Drawer/Toast（TECH-STACK §7 反模式清单）。
- 新增依赖前先看 `TECH-STACK.md` §1 的「不要装」清单。
- 每完成一步，在本文件「已完成」表里加一行，并把「下一步」第一条删掉。
- 原型 `prototype/index.html` 保留不动，它是交互参考基准，不是要维护的代码。

# TECH-STACK · 落地清单

> 配套 [`DESIGN.md`](DESIGN.md) 第 9 章。设计文档讲**为什么**，这里只讲**怎么装、怎么用、什么不许写**。
> 版本取自 2026-11 的 npm 最新版。

## 0. 一条原则

**组件库有的，一律用；只有业务逻辑和业务外观自己写。**

判断标准很简单：如果这段代码在任何一个后台管理系统里都会出现（下拉、弹窗、表格、日期选择、拖拽、撤销），那它就应该来自库。

## 1. 依赖清单

```bash
# 脚手架
npm create vite@latest . -- --template react-ts

# 运行时
npm i antd @ant-design/icons @xyflow/react @dagrejs/dagre \
      zustand immer zundo dexie dexie-react-hooks zod \
      @uiw/react-md-editor echarts echarts-for-react \
      cmdk react-hotkeys-hook framer-motion @dnd-kit/core dayjs \
      ai @ai-sdk/openai

# 开发
npm i -D vitest @vitest/coverage-v8 @playwright/test @testing-library/react \
         @testing-library/jest-dom jsdom @biomejs/biome

# 桌面壳（已采用）
npm i -D electron concurrently wait-on cross-env
```

可选（按需，先别装）：

| 包 | 什么时候装 |
| --- | --- |
| `elkjs` | dagre 的交叉线太多、节点破 200 时 |
| `electron-builder` | 要出安装包（NSIS）时；需要额外下载打包工具，网络不稳时先别碰 |
| `@tanstack/react-virtual` | antd Table 虚拟滚动不够用时 |

**不要装**：`shadcn/ui`（复制源码模式）、第二个 UI 库（MUI/Mantine/Chakra 任选其一都行，但只能有一个）、`react-dnd`（用 dnd-kit）、`styled-components`（antd 6 自带 CSS-in-JS）。

### 1.1 桌面端的三个硬约束（已经踩过）

| 约束 | 为什么 | 做法 |
| --- | --- | --- |
| **不能用 `file://` 加载** | Chromium 把 `file://` 当 opaque origin，IndexedDB 直接不可用，Dexie 会静默降级 | 自定义协议 `app://bluemap`，`privileges: { standard, secure, supportFetchAPI }`，用 `protocol.handle` 映射到 `dist/` |
| **Vite 要 `base: "./"`** | 打包后资源以相对路径加载，否则 `app://` 下 404 | `vite.config.ts` 里 `base: "./"` |
| **AI 不能再依赖 Vite 代理** | 打包后没有 dev server | 渲染进程调 `window.bluemap.aiRequest`，主进程 `net.fetch` 直连；浏览器路径保留 `/api/deepseek` |

## 2. AI 接入（DeepSeek）

**Key 由你本人填写。代码、仓库、`.env` 提交历史里都不出现真实值。**

```ts
// src/ai/provider.ts
export interface AIProvider {
  suggest(ctx: LearningContext): Promise<Suggestion[]>;
  expandNode(node: Node): Promise<NodeDraft[]>;
  explain(node: Node, q: string): AsyncIterable<string>;
  makeQuiz(node: Node, n: number): Promise<Exercise[]>;
  grade(node: Node, answer: string): Promise<{ score: number; why: string }>;
}

// src/ai/deepseek.ts
import { createOpenAI } from "@ai-sdk/openai";
const ds = createOpenAI({
  baseURL: import.meta.env.VITE_DEEPSEEK_BASE ?? "https://api.deepseek.com",
  apiKey:  import.meta.env.VITE_DEEPSEEK_KEY ?? "",   // 仅本地开发；公共部署走代理
});
export const deepseek: AIProvider = { /* generateObject + zod */ };

// src/ai/index.ts —— 无 Key 时自动降级，绝不抛错阻塞界面
export function getProvider(): AIProvider {
  return (import.meta.env.VITE_DEEPSEEK_KEY || getStoredKey()) ? deepseek : localRules;
}
```

三种运行位置，Key 的放法不同：

| 场景 | Key 放哪 | 备注 |
| --- | --- | --- |
| 本地开发 | `.env.local` 的 `VITE_DEEPSEEK_KEY` | 必须进 `.gitignore`；注意 Vite 会把它打进客户端包 |
| 自用桌面（Tauri） | 系统钥匙串，运行时取 | 最安全，长期自用推荐这条 |
| 公共部署 | 后端环境变量 | 前端只调自己的 `/api/ai`，绝不下发 Key |

**开发期代理**（同时解决 CORS 与"Key 不进前端包"）：

```ts
// vite.config.ts
server: {
  proxy: {
    "/api/deepseek": {
      target: "https://api.deepseek.com",
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/api\/deepseek/, ""),
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_KEY}` },
    },
  },
}
```

约定：

- 设置页填的 Key 存 Dexie `settings`，**不进日志、不进导出的 JSON**（导出时显式剔除）。
- 生成类调用一律 `generateObject` + zod；校验失败重试 2 次，仍失败就展示错误，不猜。
- 未配置 Key：AI 面板显示"未配置"，功能降级为本地规则，**不弹错、不阻塞**。
- 默认模型 `deepseek-chat`；需要推理链时切 `deepseek-reasoner`，成本更高，别设成默认。

## 3. Provider 装配顺序

```
<ConfigProvider theme={blueMapTheme} locale={zhCN}>   ← antd 主题 + 中文
  <AntdApp>                                          ← import { App as AntdApp } from "antd"
    <DbBootstrap>                                    ← 等 Dexie 初始化，约 10 行，不是组件库替代品
      <RouterProvider />
    </DbBootstrap>
  </AntdApp>
</ConfigProvider>
```

主题 token 示意（把设计稿的暗色游戏感压到 token 上，而不是到处写内联样式）：

```ts
import { theme } from "antd";

export const blueMapTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#38bdf8",
    colorBgBase:  "#070d18",
    colorBgContainer: "#111a2b",
    borderRadius: 12,
    fontFamily: `ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`,
  },
  components: {
    Drawer:    { colorBgElevated: "#0b1220" },
    Modal:     { contentBg: "#111a2b" },
    Segmented: { itemSelectedBg: "rgba(251,191,36,.16)" },
  },
};
```

> ⚠️ **不要劫持语义色**。把 `colorSuccess` 改成金色、`colorError` 改成粉色，会让所有成功/错误提示跟着变色。节点状态色单独定义常量，只往下传给 `Tag` / `Progress` 的 `color` / `strokeColor`：
>
> ```ts
> export const STATE_COLOR = {
>   locked:    "#4b5a74",
>   available: "#38bdf8",
>   learning:  "#f59e0b",
>   mastered:  "#fbbf24",
>   review:    "#f472b6",
> } as const;
> ```

## 4. 装配顺序（M1 第一天的顺序，别跳）

1. **脚手架 + Biome + antd 主题**：先让 `ConfigProvider` 生效，随便放个 `Button` 验证暗色与主色。
2. **Dexie schema**：`blueprints / nodes / edges / reviews / settings` 五张表 + 迁移函数，先写 `useLiveQuery` 读空表。
3. **React Flow 空画布**：只要能用滚轮缩放、拖拽平移、点空白取消选中，就说明库接对了。
4. **第一个自定义节点**：用 `Tag` + `Progress` 拼外观，确认 `nodeTypes` 注册、选中态、拖拽都不用手写。
5. **dagre 布局**：`dagre.layout()` → 写回 `position`，确认 20 个节点能自动排开。
6. **节点抽屉**：`Drawer` + `Form` + `Segmented`，掌握度改动写库。
7. **撤销重做**：`zundo` 包住 store，确认节点移动可 `Ctrl+Z`。

到这一步，第 4 章 P0 的星图骨架就齐了，而且几乎没有手写的交互代码。

## 5. 目录职责（谁能出现什么）

| 目录 | 允许出现 | 禁止出现 |
| --- | --- | --- |
| `domain/` | 纯函数、类型、常量 | 任何 `import react` / DOM API |
| `ui/` | 主题 token、全局样式、Provider | 业务逻辑 |
| `graph/` | React Flow 装配、节点/边组件、连线校验 | 布局算法（放 domain）、数据存取 |
| `features/` | 页面与容器组件（组合 antd + graph） | 手写交互机制 |
| `store/` | zustand slice、zundo 配置 | 直接操作 DOM |
| `ai/` | prompt、zod schema、SDK 调用 | UI 状态 |
| `persist/` | Dexie schema、迁移、导入导出 | 业务规则 |

## 6. 组件速查（容易踩的点）

| 场景 | 用 | 注意 |
| --- | --- | --- |
| 弹提示 | `App.useApp().message` | 不要 `message.success()` 静态调用，拿不到主题上下文 |
| 确认删除 | `Popconfirm` | 比 `Modal.confirm` 轻量，就地确认不打断上下文 |
| 抽屉里放表单 | `Drawer` + `Form` | `Form` 要 `layout="vertical"` |
| 大量节点 | React Flow `onlyRenderVisibleElements` | 打开后小地图仍会显示全部节点，属正常 |
| 连线校验 | `isValidConnection` 回调 | 环检测调 `domain/graph.ts`，别在组件里写算法 |
| 自动布局 | `useEffect` 里 dagre → `setNodes` | 位置变了要 `fitView()`，否则用户视角丢失 |
| 撤销 | `zundo` 的 `partialize` | 只记录 `nodes/edges`，别把「选中态」写进历史 |
| 键盘快捷键 | `useHotkeys("f", ...)` | 默认在 `input`/`textarea` 内不触发；确实要全局时再开 `enableOnFormTags` |
| 日历热力图 | ECharts `calendar` + `visualMap` | 记得 `lazy` 加载 echarts |
| 命令面板 | `cmdk` 的 `Command.Dialog` | 自带弹层结构但无样式，用 CSS 变量或外面套 `Modal` |
| 调用模型 | `generateObject({ schema })` | schema 用 zod，一次定义同时给类型和校验 |

## 7. Code review 反模式清单

任何一条出现在 PR 里，都说明违反了"库优先"：

- [ ] 手写 `onPointerDown/Move/Up` 实现拖拽、平移、框选
- [ ] 自己算三次贝塞尔路径、自己维护视口 `transform` 矩阵
- [ ] 自写 Modal / Drawer / Tooltip / Dropdown / Confirm
- [ ] 自写 Toast 队列或层级管理（z-index 战争）
- [ ] 自写受控输入 + 校验 + 错误提示（那是 `Form.Item`）
- [ ] 自写撤销历史栈
- [ ] 自写虚拟滚动
- [ ] 为"以后可能复用"而抽一个 `Button` / `Card` / `Tag` 包装层

> 最后一条尤其常见：**包装层不是复用，是负担**。只有在需要统一业务语义时才包（如 `MasterySegmented`），纯样式包装一律拒绝。

## 8. 版本与升级

- 所有依赖用 `^` 锁大版本；`package-lock.json` 进仓库。
- 每季度升一次 minor，升级前先跑 `npm test` + Playwright 三条主流程（画节点 / 连线 / 复习）。
- antd 大版本升级（6 → 7）单独开分支，不跟业务改动混在一起。
- 若因故降级到 antd 5，需要额外装 `@ant-design/v5-patch-for-react-19`（React 19 兼容层）。

## 9. M1 验收（对着这条走）

1. 新建蓝图 → 加 10 个节点 → 连 8 条依赖 → 刷新页面数据还在。
2. 拖动节点位置后，`Ctrl+Z` 能回退，再 `Ctrl+Shift+Z` 能重做。
3. 造一个 A→B→C→A 的连线，被 `isValidConnection` 拒绝且给出提示。
4. 点「自动布局」，20 个节点在 300ms 内排成 4 层，无节点重叠。
5. 导出 JSON → 清库 → 导入，节点/边/掌握度完全一致。
6. 全站没有任何手写的拖拽、弹窗、下拉、提示组件。
7. **不填 Key 时 AI 面板正常降级；填 Key 后能拿到一次真实建议，且导出的 JSON 里不含 Key。**

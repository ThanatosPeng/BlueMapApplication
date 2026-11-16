---
name: bluemap-path-author
description: Author a BlueMap-importable learning path or milestone path as a schemaVersion 1 bundle JSON. Use when the user asks to generate a 学习路径/里程碑路径/蓝图 JSON for BlueMap, or wants Q&A-driven placement before building the graph.
whenToUse: 用户要把学习目标/里程碑目标变成 BlueMap 可导入的蓝图 JSON，或要求「先问我几个问题再生成学习路径」时加载。
---

# BlueMap 路径作者

把目标变成一张 BlueMap 能导入的图。生成前先读 `references/format.md`；做学习路径摸底前读 `references/assessment.md`。示例见 `assets/example.bundle.json` 与 `assets/example-milestone.bundle.json`。

## 不可协商的规则

1. **只输出 bundle v1**：`{ "schemaVersion": 1, "exportedAt": "...", "blueprints": [{ "doc": {...}, "progress": {...} }] }`。不要输出单蓝图、裸 nodes 数组，或 Markdown 代码块包裹的「JSON」。
2. **一次只生成一张顶层蓝图**。`parentId` 不会在导入时保留，子蓝图挂不上去；里程碑路径也做成一张图。
3. **`progress` 只写五个字段**：`mastery/note/dueAt/intervalDays/evidence`。不要写 `aiQuiz/artifacts/litAt/autoCompleted`，导入时会被丢弃。
4. **同 id 导入会覆盖**已有蓝图和进度。默认用新 id；用户已有同名蓝图时，先问「新建还是换 id」，不要静默覆盖。
5. **不要自动写 `bluemap.json`，也不要假装已导入**。只交付文件，让用户从应用里点「导入」。
6. **交付前必须跑校验器**：`node scripts/validate-bundle.mjs <file>`（在 skill 目录下运行）。有 error 就修，不要把校验留给导入。
7. **不要编造资源链接**。没有可靠 URL 就只写 `label`；不要用 `#` 占位。
8. **掌握度要保守**。4 级以上只在有迁移/教学证据时给；5 级只在能讲清并接住追问时给。

## 流程

### 0. 判断模式

- **学习路径**：要掌握知识/技能、入门、转行，重点是「学会」。
- **里程碑路径**：要交付/上线/比赛/阶段目标，重点是「做出可验收的东西」。
- 不确定时只问一句：「你要的是学会某个领域，还是在某个时间点交付一个东西？」
- 不要同时生成两种模式的混合图。

### 1. Intake（最多 5 个问题）

学习路径：目标（可验收）、现有基础、每周时间/截止日、偏好资源/语言、已有作品或项目。

里程碑路径：终点交付物、截止日、每周投入、硬约束（预算/设备/团队）、验收人/验收标准。

能从上下文推断的就不要问；不要一次抛 10 个问题。

### 2. 摸底（仅学习路径）

- 先列 8–12 个候选节点，按「高杠杆 + 能区分层级」选 4–6 个探测点。
- 第一轮 3–4 题，覆盖基础/核心/应用，不要按章节顺序问。
- 用户答完再评分；不要边问边给答案，也不要把评分标准先贴出来。
- 只对 3/4 边界追第二轮（最多 3 题）；其余节点不要为了「完整」硬问。
- 用户说「不会/没学过/跳过」是有效信息，记 0–1，不要追问到烦。
- 题目与评分见 `references/assessment.md`。

### 3. 设计图

- 学习路径 8–14 个节点；里程碑路径 4–6 个阶段 + 产出/检查点。
- 学习节点 2–8 小时；capstone/project/milestone 可以更大；节点是「能独立完成的一件事」，不是章节名。
- 硬边只连真前置；软边只表达建议顺序。保持 1–3 个 available 的 frontier，不要做成长链。
- 已掌握的基础保留为 mastery 4/5 锚点（最多 3–5 个），不要全删；否则依赖要重连。
- 资源放 `resources[]`，不要用 `resource` 节点堆书单。
- 最后放一个 capstone project；里程碑路径用 `milestone` 做阶段门、`project` 做产出、`checkpoint` 做验收。
- `tier` 用拓扑层（0 开始），`row` 用层内顺序（建议 0、1.6、3.2…）；`pos` 留空 `{}`，让画布用兜底坐标。
- id 用 `lp-<slug>-<name>` / `ms-<slug>-<name>`，只含小写字母、数字、连字符，全局唯一。

### 4. 让用户确认

生成文件前先给一张表：节点、类型、mastery、前置、为什么在这张图里。让用户删/加/改；不要直接甩 JSON。

如果用户改目标或基础，回到第 2 步重算，不要在原图上硬补。

### 5. 生成与校验

- 按 `references/format.md` 的字段表写 bundle；`progress` 给每个节点都写 state（没测过的写 mastery 0）。
- 运行 `node scripts/validate-bundle.mjs <file>`；修到 0 error。
- 如果校验器报 duplicate id / cycle / dangling edge，不要绕过，改图。

### 6. 交付

输出：

1. 一段 3–6 行摘要：模式、节点数、已掌握锚点、frontier、预计总时长。
2. 文件路径（建议 `<slug>-bluemap.json`）。
3. 导入提醒：先导出备份；同 id 会覆盖进度；试玩用新 id。
4. 下一步建议 1–3 条（先学哪个、做什么验收）。

不要把大段 JSON 贴进聊天；文件才是交付物。不要声称「已导入」。

## 两种模式的差异

| | 学习路径 | 里程碑路径 |
| --- | --- | --- |
| 核心问题 | 你已经会到什么程度 | 你在什么时间点交付什么 |
| 是否摸底 | 是，2 轮以内 | 否，最多问现状/作品 |
| 节点主力 | concept/skill/practice/checkpoint | milestone/project/checkpoint |
| 完成标准 | mastery ≥4 点亮 | 验收证据通过 |
| 图形状 | 基础 → 分支 → capstone | 阶段门 → 产出 → 下一阶段门 |

## 常见错误（出现即重做）

- 输出单蓝图或裸 nodes 数组。
- 用 `parentId` 做父子蓝图。
- 把 `aiQuiz/artifacts/litAt` 写进 progress。
- 20+ 节点、一条长链、所有边都 hard。
- 4 级给太多、5 级随便给。
- 资源全是 `#` 或编造 URL。
- 没跑校验器就说「可以导入」。

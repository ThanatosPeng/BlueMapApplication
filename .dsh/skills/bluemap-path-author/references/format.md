# BlueMap bundle 格式（schemaVersion 1）

**真源**：`src/domain/serialize.ts` 的 zod schema，以及 `src/store/useAppStore.ts` 的 `importAll`。
**不要照抄** `DESIGN.md` §6.2 的单蓝图示例——那是早期设计稿，当前导入器只认 bundle。

## 1. 顶层结构

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-11-16T00:00:00.000Z",
  "blueprints": [
    {
      "doc": { "id": "...", "title": "...", "goal": "...", "nodes": [], "edges": [] },
      "progress": { "nodes": {}, "pos": {} }
    }
  ]
}
```

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `schemaVersion` | number | 是 | 必须严格等于 `1` |
| `exportedAt` | string | 是 | 任意非空字符串；建议 ISO 时间 |
| `blueprints` | array | 是 | 至少 1 项；每项 `{ doc, progress }` |

导入多张蓝图时会全部写入，并自动打开第一张。不要用多张蓝图表达父子关系。

## 2. `doc` 字段

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `id` | string | 是 | 非空；同 id 导入会覆盖旧蓝图 |
| `title` | string | 是 | 非空 |
| `goal` | string | 是 | 可为空；建议一句可验收的话 |
| `nodes` | array | 是 | 至少 1 个节点 |
| `edges` | array | 是 | 可为空 |
| `parentId` | - | 否 | **不要写**，导入时会被丢弃 |

## 3. `node` 字段

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `id` | string | 是 | 蓝图内唯一；建议全局命名空间 |
| `title` | string | 是 | 非空；建议 ≤14 字 |
| `sub` | string | 是 | 可为空；建议 ≤20 字 |
| `type` | enum | 是 | `concept/skill/practice/project/milestone/resource/checkpoint` |
| `desc` | string | 否 | 学完能做什么 / 验收标准 |
| `hours` | number | 否 | 预计投入；学习节点建议 2–8 |
| `tier` | number | 是 | 拓扑层，0 开始 |
| `row` | number | 是 | 层内纵向位置，建议 0、1.6、3.2… |
| `resources` | array | 是 | 可为空；每项 `{ label, url? }` |

`resources` 的 `label` 是字符串，`url` 可选。宁可只写 `label`，也不要编造链接或用 `#` 占位。

### 节点类型语义

| 类型 | 用来表达 | 建议 |
| --- | --- | --- |
| `concept` | 知识点 | 能讲清 + 能应用 |
| `skill` | 可操作能力 | 有练习或作品 |
| `practice` | 刻意练习单元 | 2–8 小时能完成 |
| `project` | 综合产出 | 有可展示的验收物 |
| `milestone` | 阶段目标 | 少量使用，视觉更大、XP 更高 |
| `resource` | 课程/书 | 通常不参与解锁；不建议用来堆书单 |
| `checkpoint` | 自测关卡 | 验收标准写进 `desc` |

## 4. `edge` 字段

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `id` | string | 是 | 蓝图内唯一 |
| `from` | string | 是 | 必须指向本蓝图节点 |
| `to` | string | 是 | 必须指向本蓝图节点 |
| `kind` | enum | 是 | `hard` 或 `soft` |

- `hard`：真前置。前置节点的 mastery ≥3 才解锁当前节点。
- `soft`：只做推荐排序和「建议先看」提示，不阻断。
- 达到 mastery 4 才算「点亮」。
- 不要把整张图连成一条全 `hard` 的长链；保持 1–3 个 available 的 frontier。

## 5. `progress` 字段

```json
{
  "nodes": {
    "node-id": {
      "mastery": 3,
      "note": "",
      "dueAt": null,
      "intervalDays": 0,
      "evidence": { "self": false, "quiz": false, "artifact": false, "ai": false }
    }
  },
  "pos": {}
}
```

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `nodes` | object | 是 | key = 节点 id；value = nodeState |
| `pos` | object | 是 | 可为空 `{}`；value = `{ x, y }` |

nodeState 的五个字段**全部必填**：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `mastery` | number | 0–5；本技能统一用整数 |
| `note` | string | 可为空 |
| `dueAt` | number \| null | 建议 `null` |
| `intervalDays` | number | 建议 `0` |
| `evidence` | object | `self/quiz/artifact/ai` 四个布尔值全部要给 |

`evidence` 是旧版证据字段，保留仅为兼容；本技能统一写四个 `false`，掌握度以 `mastery` 为准。

## 6. 导入时会丢的字段

导入 schema 会静默丢弃以下字段：

- `doc.parentId`
- `progress.nodes[*].litAt`
- `progress.nodes[*].autoCompleted`
- `progress.nodes[*].artifacts`
- `progress.nodes[*].aiQuiz`
- 其他未在 schema 中声明的字段

所以：

- 不要生成「父蓝图 + 子蓝图」的层级；子蓝图关系挂不上。
- 不要承诺导入后有时间轴点亮历史、问答记录或作品证据。
- 不要把这些字段写进 bundle；写了也不会保留。

导出的文件里可能仍然包含这些字段，但**再次导入时会被丢掉**。要完整备份，直接复制应用数据目录里的 `bluemap.json`，不要依赖导出/导入往返。

## 7. 导入器实际检查什么

`parseBundle` 只做四件事：

1. JSON 能解析。
2. 顶层与字段符合 zod schema。
3. 每条边的 `from/to` 都指向本蓝图里存在的节点（悬空边拒绝）。
4. 整张图无环（循环依赖拒绝）。

它**不检查**：重复蓝图 id、重复节点 id、重复边、重复边 id、保留 id、mastery 是否为整数、`progress` 的 key 是否对应真实节点。这些由 `scripts/validate-bundle.mjs` 补查。

导入是**整包拒绝**：任何一张蓝图不合法，整包都不写入。

## 8. 同 id 覆盖

`importAll` 对每张蓝图执行 `saveBlueprint(id, doc)` 和 `saveProgress(id, progress)`：

- 同 id 会**整份替换** doc 与 progress；
- 笔记、作品、复习排期、AI 问答记录不会合并；
- 导入后自动打开第一张蓝图。

所以默认用新 id 生成。要“重规划”时，先和用户确认：

1. 新建一张蓝图（保留旧进度），或
2. 用户明确知道会覆盖，再复用 id。

## 9. 布局

- 节点尺寸：普通 186×86；`milestone` 214×98。
- 没有 `pos` 时，画布用 `x = tier * 280`、`y = row * 130` 兜底。
- 建议 `tier` 按拓扑层递增，`row` 在层内用 0、1.6、3.2… 留出间距；milestone 更高，间距至少 1.5。
- `pos` 给空对象 `{}` 即可；如果给，必须覆盖所有想固定位置的节点，并保证不重叠。
- 应用里的「dagre 重排」会按左到右分层重新布局，所以 `tier/row` 不合理也能救，但首次打开会难看。

## 10. id 规则

- 蓝图内节点 id 唯一；导入器不查重，但重复会让 React Flow 渲染错乱。
- 不要用 `__parent__`、`__probe__` 或 `__` 开头；`__parent__` 是画布保留 id。
- 不要用内置蓝图 id：`emb`、`vue`、`react`、`se`，否则会覆盖内置数据。
- 推荐正则：`^[a-z0-9][a-z0-9-]*$`。
- 推荐命名空间：`lp-<topic>-<name>`（学习路径）、`ms-<topic>-<name>`（里程碑路径）。

## 11. 校验

在 skill 目录下运行：

```bash
node scripts/validate-bundle.mjs <file>
```

校验器是零依赖的，检查 schema、唯一性、悬空边、自连、重边、环、mastery 整数、保留 id、会被丢弃的字段等。exit code 为 0 表示可导入；为 1 表示有 error。

## 12. 完整示例

- `assets/example.bundle.json`：学习路径（含已掌握锚点与 capstone）。
- `assets/example-milestone.bundle.json`：里程碑路径（阶段门 → 产出 → 验收）。

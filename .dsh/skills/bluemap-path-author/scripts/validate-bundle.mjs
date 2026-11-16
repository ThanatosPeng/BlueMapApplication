#!/usr/bin/env node
/**
 * BlueMap bundle 校验器（零依赖）
 *
 * 用法:
 *   node scripts/validate-bundle.mjs <bundle.json>
 *   node scripts/validate-bundle.mjs <bundle.json> --json
 *
 * 目标不是“比应用更严格”，而是把应用导入时不会拦、但会破坏图的问题提前找出来：
 * 重复 id、重复边、自连、环、保留 id、非整数 mastery、会被静默丢弃的字段。
 */

import fs from "node:fs";
import path from "node:path";

const NODE_TYPES = new Set([
  "concept",
  "skill",
  "practice",
  "project",
  "milestone",
  "resource",
  "checkpoint",
]);
const EDGE_KINDS = new Set(["hard", "soft"]);
const RESERVED_NODE_IDS = new Set(["__parent__", "__probe__"]);
const BUILTIN_BLUEPRINT_IDS = new Set(["emb", "vue", "react", "se"]);

const ALLOWED_TOP = new Set(["schemaVersion", "exportedAt", "blueprints"]);
const ALLOWED_DOC = new Set(["id", "title", "goal", "nodes", "edges"]);
const ALLOWED_NODE = new Set([
  "id",
  "title",
  "sub",
  "type",
  "desc",
  "hours",
  "tier",
  "row",
  "resources",
]);
const ALLOWED_EDGE = new Set(["id", "from", "to", "kind"]);
const ALLOWED_RESOURCE = new Set(["label", "url"]);
const ALLOWED_STATE = new Set(["mastery", "note", "dueAt", "intervalDays", "evidence"]);

const DROPPED_DOC_KEYS = ["parentId"];
const DROPPED_STATE_KEYS = ["litAt", "autoCompleted", "artifacts", "aiQuiz"];

const errors = [];
const warnings = [];
const perBlueprint = [];

const addError = (message) => errors.push(message);
const addWarning = (message) => warnings.push(message);

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isString = (value) => typeof value === "string";
const nonEmptyString = (value) => isString(value) && value.trim().length > 0;
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isBoolean = (value) => typeof value === "boolean";
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function usage() {
  console.log(
    [
      "BlueMap bundle 校验器（schemaVersion 1）",
      "",
      "用法:",
      "  node scripts/validate-bundle.mjs <bundle.json>",
      "  node scripts/validate-bundle.mjs <bundle.json> --json",
      "",
      "检查: JSON、bundle schema、必填字段、id 唯一、边端点、自连、重边、环、",
      "      保留 id、mastery 整数、progress 字段、会被静默丢弃的字段。",
      "",
      "exit code: 0 = 可导入；1 = 有 error。",
    ].join("\n"),
  );
}

function findCycle(ids, edges) {
  const adjacency = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) {
    if (!isObject(edge)) continue;
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;
    adjacency.get(edge.from).push(edge.to);
  }

  const color = new Map();
  const stack = [];
  let cycle = null;

  const visit = (id) => {
    color.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const nextColor = color.get(next) ?? 0;
      if (nextColor === 1) {
        const start = stack.indexOf(next);
        cycle = [...stack.slice(start), next];
        return true;
      }
      if (nextColor === 0 && visit(next)) return true;
    }
    stack.pop();
    color.set(id, 2);
    return false;
  };

  for (const id of ids) {
    if ((color.get(id) ?? 0) === 0 && visit(id)) break;
  }
  return cycle;
}

function validateProgress(progress, nodeIds, nodesOk, blueprintLabel) {
  let mastered = 0;

  if (!isObject(progress.nodes)) {
    addError(`${blueprintLabel} 的 progress.nodes 必须是对象`);
  } else {
    const states = progress.nodes;

    for (const [nodeId, state] of Object.entries(states)) {
      const stateLabel = `${blueprintLabel} progress.nodes["${nodeId}"]`;

      if (nodesOk && !nodeIds.has(nodeId)) {
        addWarning(`${stateLabel} 对应的节点不存在，导入后会成为无用状态`);
      }
      if (!isObject(state)) {
        addError(`${stateLabel} 必须是对象`);
        continue;
      }

      if (
        !isNumber(state.mastery) ||
        state.mastery < 0 ||
        state.mastery > 5 ||
        !Number.isInteger(state.mastery)
      ) {
        addError(`${stateLabel}.mastery 必须是 0–5 的整数`);
      } else if (state.mastery >= 4) {
        mastered += 1;
      }

      if (!isString(state.note)) addError(`${stateLabel}.note 必须是字符串`);
      if (!(state.dueAt === null || isNumber(state.dueAt))) {
        addError(`${stateLabel}.dueAt 必须是 null 或数字`);
      }
      if (!isNumber(state.intervalDays)) {
        addError(`${stateLabel}.intervalDays 必须是数字`);
      }

      if (!isObject(state.evidence)) {
        addError(`${stateLabel}.evidence 必须是对象`);
      } else {
        for (const key of ["self", "quiz", "artifact", "ai"]) {
          if (!isBoolean(state.evidence[key])) {
            addError(`${stateLabel}.evidence.${key} 必须是布尔值`);
          }
        }
      }

      for (const key of DROPPED_STATE_KEYS) {
        if (has(state, key)) addWarning(`${stateLabel}.${key} 会在导入时被丢弃`);
      }
      for (const key of Object.keys(state)) {
        if (!ALLOWED_STATE.has(key) && !DROPPED_STATE_KEYS.includes(key)) {
          addWarning(`${stateLabel}.${key} 会被导入忽略`);
        }
      }
    }

    if (nodesOk) {
      const missing = [...nodeIds].filter((id) => !has(states, id));
      if (missing.length > 0) {
        addWarning(
          `${blueprintLabel} 有 ${missing.length} 个节点没有 progress state，导入后按 mastery 0 处理：` +
            `${missing.slice(0, 5).join("、")}${missing.length > 5 ? "…" : ""}`,
        );
      }
    }
  }

  if (!isObject(progress.pos)) {
    addError(`${blueprintLabel} 的 progress.pos 必须是对象（可为空 {}）`);
  } else {
    for (const [nodeId, point] of Object.entries(progress.pos)) {
      const pointLabel = `${blueprintLabel} progress.pos["${nodeId}"]`;
      if (nodesOk && !nodeIds.has(nodeId)) {
        addWarning(`${pointLabel} 对应的节点不存在`);
      }
      if (!isObject(point) || !isNumber(point.x) || !isNumber(point.y)) {
        addError(`${pointLabel} 必须是 { x: number, y: number }`);
      }
    }
  }

  return mastered;
}

function validateBlueprint(item, index) {
  const label = `blueprints[${index}]`;
  if (!isObject(item)) {
    addError(`${label} 必须是对象`);
    return;
  }

  const doc = item.doc;
  const progress = item.progress;
  if (!isObject(doc)) {
    addError(`${label}.doc 必须是对象`);
    return;
  }
  if (!isObject(progress)) {
    addError(`${label}.progress 必须是对象`);
    return;
  }

  const blueprintLabel = nonEmptyString(doc.id) ? `蓝图「${doc.id}」` : label;

  for (const key of Object.keys(item)) {
    if (key !== "doc" && key !== "progress") {
      addWarning(`${label} 的字段 ${key} 会被导入忽略`);
    }
  }

  if (!nonEmptyString(doc.id)) {
    addError(`${label}.doc.id 必须是非空字符串`);
  } else if (BUILTIN_BLUEPRINT_IDS.has(doc.id)) {
    addWarning(`${blueprintLabel} 与内置蓝图 id 相同，导入会覆盖内置蓝图`);
  }
  if (!nonEmptyString(doc.title)) {
    addError(`${blueprintLabel} 的 title 必须是非空字符串`);
  }
  if (!isString(doc.goal)) {
    addError(`${blueprintLabel} 的 goal 必须是字符串`);
  } else if (!doc.goal.trim()) {
    addWarning(`${blueprintLabel} 的 goal 为空，建议写一句可验收的目标`);
  }

  for (const key of DROPPED_DOC_KEYS) {
    if (has(doc, key)) {
      addWarning(`${blueprintLabel} 的 ${key} 会在导入时被丢弃；请做成单张顶层蓝图`);
    }
  }
  for (const key of Object.keys(doc)) {
    if (!ALLOWED_DOC.has(key) && !DROPPED_DOC_KEYS.includes(key)) {
      addWarning(`${blueprintLabel} 的字段 ${key} 会被导入忽略`);
    }
  }

  const nodeIds = new Set();
  let nodesOk = false;

  if (!Array.isArray(doc.nodes) || doc.nodes.length === 0) {
    addError(`${blueprintLabel} 的 nodes 至少要有 1 个节点`);
  } else {
    nodesOk = true;

    doc.nodes.forEach((node, nodeIndex) => {
      const nodeLabel = `${blueprintLabel} nodes[${nodeIndex}]`;
      if (!isObject(node)) {
        addError(`${nodeLabel} 必须是对象`);
        return;
      }

      if (!nonEmptyString(node.id)) {
        addError(`${nodeLabel}.id 必须是非空字符串`);
      } else {
        if (nodeIds.has(node.id)) {
          addError(`${blueprintLabel} 出现重复节点 id「${node.id}」`);
        } else {
          nodeIds.add(node.id);
        }
        if (RESERVED_NODE_IDS.has(node.id) || node.id.startsWith("__")) {
          addError(`${blueprintLabel} 的节点 id「${node.id}」是画布保留 id`);
        }
        if (
          !RESERVED_NODE_IDS.has(node.id) &&
          !node.id.startsWith("__") &&
          !/^[a-z0-9][a-z0-9-]*$/.test(node.id)
        ) {
          addWarning(
            `${blueprintLabel} 的节点 id「${node.id}」建议只用小写字母、数字、连字符`,
          );
        }
      }

      if (!nonEmptyString(node.title)) {
        addError(`${nodeLabel}.title 必须是非空字符串`);
      } else if (node.title.length > 24) {
        addWarning(`${nodeLabel}.title 超过 24 字，卡片上可能被截断`);
      }

      if (!isString(node.sub)) {
        addError(`${nodeLabel}.sub 必须是字符串（可为空）`);
      } else if (node.sub.length > 48) {
        addWarning(`${nodeLabel}.sub 超过 48 字，卡片上可能被截断`);
      }

      if (!NODE_TYPES.has(node.type)) {
        addError(`${nodeLabel}.type 必须是 ${[...NODE_TYPES].join("/")}`);
      }
      if (!isNumber(node.tier)) addError(`${nodeLabel}.tier 必须是数字`);
      if (!isNumber(node.row)) addError(`${nodeLabel}.row 必须是数字`);

      if (!Array.isArray(node.resources)) {
        addError(`${nodeLabel}.resources 必须是数组（可为空）`);
      } else {
        node.resources.forEach((resource, resourceIndex) => {
          const resourceLabel = `${nodeLabel}.resources[${resourceIndex}]`;
          if (!isObject(resource)) {
            addError(`${resourceLabel} 必须是对象`);
            return;
          }
          if (!isString(resource.label)) {
            addError(`${resourceLabel}.label 必须是字符串`);
          } else if (!resource.label.trim()) {
            addWarning(`${resourceLabel}.label 为空`);
          }
          if (has(resource, "url")) {
            if (!isString(resource.url)) {
              addError(`${resourceLabel}.url 必须是字符串`);
            } else if (!resource.url.trim() || resource.url === "#") {
              addWarning(`${resourceLabel}.url 是占位链接，建议省略或换成真实 URL`);
            }
          }
          for (const key of Object.keys(resource)) {
            if (!ALLOWED_RESOURCE.has(key)) {
              addWarning(`${resourceLabel} 的字段 ${key} 会被导入忽略`);
            }
          }
        });
      }

      if (has(node, "desc") && !isString(node.desc)) {
        addError(`${nodeLabel}.desc 必须是字符串`);
      }
      if (has(node, "hours")) {
        if (!isNumber(node.hours)) {
          addError(`${nodeLabel}.hours 必须是数字`);
        } else if (node.hours <= 0 || node.hours > 200) {
          addWarning(`${nodeLabel}.hours 建议在 1–200 之间`);
        }
      }

      for (const key of Object.keys(node)) {
        if (!ALLOWED_NODE.has(key)) {
          addWarning(`${nodeLabel} 的字段 ${key} 会被导入忽略`);
        }
      }
    });
  }

  if (!Array.isArray(doc.edges)) {
    addError(`${blueprintLabel} 的 edges 必须是数组（可为空）`);
  } else {
    const edgeIds = new Set();
    const pairs = new Set();

    doc.edges.forEach((edge, edgeIndex) => {
      const edgeLabel = `${blueprintLabel} edges[${edgeIndex}]`;
      if (!isObject(edge)) {
        addError(`${edgeLabel} 必须是对象`);
        return;
      }

      if (!nonEmptyString(edge.id)) {
        addError(`${edgeLabel}.id 必须是非空字符串`);
      } else if (edgeIds.has(edge.id)) {
        addError(`${blueprintLabel} 出现重复边 id「${edge.id}」`);
      } else {
        edgeIds.add(edge.id);
      }

      const fromOk = nonEmptyString(edge.from);
      const toOk = nonEmptyString(edge.to);
      if (!fromOk) addError(`${edgeLabel}.from 必须是非空字符串`);
      if (!toOk) addError(`${edgeLabel}.to 必须是非空字符串`);
      if (!EDGE_KINDS.has(edge.kind)) {
        addError(`${edgeLabel}.kind 必须是 hard 或 soft`);
      }

      if (fromOk && toOk && edge.from === edge.to) {
        addError(`${edgeLabel} 不能连到自己`);
      }

      if (fromOk && toOk) {
        const pair = `${edge.from}->${edge.to}`;
        if (pairs.has(pair)) {
          addError(`${blueprintLabel} 出现重复依赖 ${pair}`);
        } else {
          pairs.add(pair);
        }
        if (nodesOk) {
          if (!nodeIds.has(edge.from)) {
            addError(`${edgeLabel}.from 指向不存在的节点「${edge.from}」`);
          }
          if (!nodeIds.has(edge.to)) {
            addError(`${edgeLabel}.to 指向不存在的节点「${edge.to}」`);
          }
        }
      }

      for (const key of Object.keys(edge)) {
        if (!ALLOWED_EDGE.has(key)) {
          addWarning(`${edgeLabel} 的字段 ${key} 会被导入忽略`);
        }
      }
    });

    if (nodesOk) {
      const cycle = findCycle([...nodeIds], doc.edges);
      if (cycle) {
        addError(`${blueprintLabel} 存在循环依赖：${cycle.join(" → ")}`);
      }
    }
  }

  const mastered = validateProgress(progress, nodeIds, nodesOk, blueprintLabel);

  perBlueprint.push({
    id: nonEmptyString(doc.id) ? doc.id : `#${index + 1}`,
    nodes: Array.isArray(doc.nodes) ? doc.nodes.length : 0,
    edges: Array.isArray(doc.edges) ? doc.edges.length : 0,
    mastered,
  });
}

function printReport(file) {
  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          file,
          ok: errors.length === 0,
          blueprints: perBlueprint,
          warnings,
          errors,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\nBlueMap bundle 校验：${file}`);
  for (const blueprint of perBlueprint) {
    console.log(
      `  ${blueprint.id} · ${blueprint.nodes} 节点 / ${blueprint.edges} 边 / ${blueprint.mastered} 已点亮`,
    );
  }

  if (warnings.length > 0) {
    console.log(`\n警告 ${warnings.length}:`);
    for (const warning of warnings) console.log(`  - ${warning}`);
  }

  if (errors.length > 0) {
    console.log(`\n错误 ${errors.length}:`);
    for (const error of errors) console.log(`  ✗ ${error}`);
    console.log("\n结果：FAIL（先修错误，再导入）");
    return;
  }

  console.log(warnings.length > 0 ? "\n结果：PASS（有警告，建议处理）" : "\n结果：PASS");
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  usage();
  process.exit(0);
}

const jsonMode = argv.includes("--json");
const fileArg = argv.find((arg) => !arg.startsWith("-"));
if (!fileArg) {
  usage();
  process.exit(1);
}

const absolutePath = path.resolve(fileArg);
let text;
try {
  text = fs.readFileSync(absolutePath, "utf8");
} catch (error) {
  console.error(`读不到文件：${absolutePath}`);
  console.error(error?.message ?? String(error));
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(text.replace(/^\uFEFF/, ""));
} catch (error) {
  addError(`不是合法 JSON：${error?.message ?? String(error)}`);
  printReport(absolutePath);
  process.exit(1);
}

if (!isObject(raw)) {
  addError("顶层必须是 JSON 对象");
} else {
  if (raw.schemaVersion !== 1) {
    addError(`schemaVersion 必须是数字 1（当前：${JSON.stringify(raw.schemaVersion)}）`);
  }
  if (!nonEmptyString(raw.exportedAt)) {
    addError("exportedAt 必须是非空字符串");
  } else if (Number.isNaN(Date.parse(raw.exportedAt))) {
    addWarning("exportedAt 不是可解析的时间，建议用 ISO 字符串");
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_TOP.has(key)) addWarning(`顶层字段 ${key} 会被导入忽略`);
  }

  if (!Array.isArray(raw.blueprints)) {
    addError("blueprints 必须是数组");
  } else if (raw.blueprints.length === 0) {
    addError("blueprints 至少要有 1 张蓝图");
  } else {
    if (raw.blueprints.length > 1) {
      addWarning(`blueprints 有 ${raw.blueprints.length} 张，导入后会全部写入并打开第一张`);
    }
    const seenBlueprintIds = new Set();
    raw.blueprints.forEach((item, index) => {
      if (isObject(item) && isObject(item.doc) && nonEmptyString(item.doc.id)) {
        if (seenBlueprintIds.has(item.doc.id)) {
          addError(`blueprints 出现重复蓝图 id「${item.doc.id}」`);
        } else {
          seenBlueprintIds.add(item.doc.id);
        }
      }
      validateBlueprint(item, index);
    });
  }
}

printReport(absolutePath);
process.exit(errors.length > 0 ? 1 : 0);

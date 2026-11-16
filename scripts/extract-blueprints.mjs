// 从 prototype/index.html 抽取蓝图种子数据，生成 src/data/blueprints.json
// 原型是一次性验证件，但内容是真实资产，正式工程直接复用，避免手抄出错。
import fs from "node:fs";

const html = fs.readFileSync("prototype/index.html", "utf8");

function grab(startMarker, endMarker) {
  const i = html.indexOf(startMarker);
  const j = html.indexOf(endMarker, i);
  if (i < 0 || j < 0) throw new Error(`marker not found: ${startMarker}`);
  const src = html.slice(i + startMarker.length, j).trim().replace(/;$/, "");
  return Function(`"use strict"; return (${src});`)();
}

const base = grab("const BLUEPRINTS = ", "\n\n/* ================= 补充蓝图");
const extra = grab("const EXTRA_BLUEPRINTS = ", "\n\n// 去掉演示用");

const all = [...extra, ...base.filter((b) => b.id !== "en")];

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/blueprints.json", JSON.stringify(all, null, 2), "utf8");
console.log(
  "blueprints:",
  all.map((b) => `${b.id}(${b.nodes.length}n/${b.edges.length}e)`).join(" "),
);

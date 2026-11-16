import { z } from "zod";
import { detectCycle } from "./graph";
import type { Blueprint, ProgressDoc } from "./types";

const resourceSchema = z.object({
  label: z.string(),
  url: z.string().optional(),
});

const nodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sub: z.string(),
  type: z.enum([
    "concept",
    "skill",
    "practice",
    "project",
    "milestone",
    "resource",
    "checkpoint",
  ]),
  desc: z.string().optional(),
  hours: z.number().optional(),
  tier: z.number(),
  row: z.number(),
  resources: z.array(resourceSchema),
});

const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: z.enum(["hard", "soft"]),
});

const blueprintSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string(),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema),
});

const nodeStateSchema = z.object({
  mastery: z.number().min(0).max(5),
  note: z.string(),
  dueAt: z.number().nullable(),
  intervalDays: z.number(),
  evidence: z.object({
    self: z.boolean(),
    quiz: z.boolean(),
    artifact: z.boolean(),
    ai: z.boolean(),
  }),
});

const progressSchema = z.object({
  nodes: z.record(z.string(), nodeStateSchema),
  pos: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
});

export const bundleSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  blueprints: z.array(z.object({ doc: blueprintSchema, progress: progressSchema })),
});

export interface BundleItem {
  doc: Blueprint;
  progress: ProgressDoc;
}

export interface Bundle {
  schemaVersion: 1;
  exportedAt: string;
  blueprints: BundleItem[];
}

/** 导出时只带蓝图与进度，AI Key 存在 settings 表里，天然不会进文件 */
export function buildBundle(items: BundleItem[]): Bundle {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    blueprints: items,
  };
}

export type ParseResult =
  | { ok: true; bundle: Bundle }
  | { ok: false; reason: string };

/**
 * 导入前必须过三关：JSON 合法、结构符合 schema、依赖图健全。
 * 坏数据宁可整包拒绝，也不要把半张图写进库。
 */
export function parseBundle(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "不是合法的 JSON 文件" };
  }

  const parsed = bundleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      reason: `结构不符合 BlueMap 格式：${first?.path.join(".") ?? ""} ${first?.message ?? ""}`.trim(),
    };
  }

  for (const item of parsed.data.blueprints) {
    const ids = new Set(item.doc.nodes.map((n) => n.id));
    const dangling = item.doc.edges.find((e) => !ids.has(e.from) || !ids.has(e.to));
    if (dangling) {
      return { ok: false, reason: `蓝图「${item.doc.title}」有指向不存在节点的依赖` };
    }
    if (detectCycle(item.doc.edges)) {
      return { ok: false, reason: `蓝图「${item.doc.title}」存在循环依赖` };
    }
  }

  return { ok: true, bundle: parsed.data as Bundle };
}

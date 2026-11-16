import { z } from "zod";
import type { Blueprint, GraphNode } from "../domain/types";

export const draftSchema = z.object({
  title: z.string().min(1).max(24),
  sub: z.string().max(48).default(""),
  hours: z.number().min(0.5).max(200).optional(),
});

export const draftListSchema = z.array(draftSchema).min(1).max(6);

export type NodeDraft = z.infer<typeof draftSchema>;

/** 让模型把一个大节点拆成 3–5 个可执行的小节点 */
export function buildExpandPrompt(node: GraphNode, bp: Blueprint): string {
  const prereqs = bp.edges
    .filter((e) => e.to === node.id)
    .map((e) => bp.nodes.find((n) => n.id === e.from)?.title)
    .filter(Boolean);

  return [
    `学习蓝图：《${bp.title}》，目标：${bp.goal}`,
    `要拆解的节点：「${node.title}」`,
    `它的说明：${node.desc ?? node.sub}`,
    `预计投入：${node.hours ?? "未知"} 小时`,
    `前置知识：${prereqs.join("、") || "无"}`,
    "",
    "请把它拆成 3–5 个更小、可独立完成的子节点，要求：",
    "1. 每个子节点能在 2–8 小时内完成；",
    "2. 子节点之间尽量没有相互依赖，都接在父节点下面；",
    "3. 标题不超过 12 个字，说明不超过 20 个字；",
    '4. 只输出 JSON 数组，元素形如 {"title":"...","sub":"...","hours":4}。',
    "不要输出任何解释、代码块标记或多余文字。",
  ].join("\n");
}

/** 容错解析：模型可能包 ```json 代码块，也可能前后带解释 */
export function parseDrafts(
  text: string,
): { ok: true; drafts: NodeDraft[] } | { ok: false; reason: string } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let payload = (fenced ? fenced[1] : text).trim();

  if (!fenced) {
    const start = payload.indexOf("[");
    const end = payload.lastIndexOf("]");
    if (start >= 0 && end > start) payload = payload.slice(start, end + 1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { ok: false, reason: "模型没有返回合法 JSON，换一次试试或换个模型" };
  }

  const parsed = draftListSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      reason: `拆解结果格式不对：${first?.path.join(".") ?? ""} ${first?.message ?? ""}`.trim(),
    };
  }
  return { ok: true, drafts: parsed.data };
}

import type { ArtifactRef, GraphNode } from "../domain/types";

/** 让 AI 读作品内容（README / 关键代码）后给一个掌握度判断 */
export function buildArtifactPrompt(
  node: Pick<GraphNode, "title" | "sub">,
  artifact: ArtifactRef,
): string {
  return [
    `我在学「${node.title}」（${node.sub}）。`,
    `这是我自己做的作品：${artifact.label ?? artifact.ref}`,
    `类型：${artifact.kind === "repo" ? "在线仓库" : "本地路径"}，地址：${artifact.ref}`,
    artifact.content ? `内容摘要：\n"""\n${artifact.content.slice(0, 4000)}\n"""` : "（没有提供内容，只能依据描述判断，请谨慎给分）",
    "请判断我对该节点的掌握度：0 完全不会、2 能照抄着做、3 能独立完成、4 能迁移到新场景、5 能做架构级取舍。",
    '只输出 JSON：{"score": 0-5, "summary": "一句话点评：这份作品证明了什么、还缺什么"}，不要 Markdown。',
  ].join("\n");
}

export function parseArtifactReview(text: string): { score: number; summary: string } {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  try {
    const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as {
      score?: unknown;
      summary?: unknown;
    };
    const score = Math.max(0, Math.min(5, Math.round(Number(parsed.score))));
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (Number.isFinite(score)) {
      return { score, summary: summary || "（AI 没给点评）" };
    }
  } catch {
    // 落到兜底
  }

  const number = cleaned.match(/\d/);
  return {
    score: number ? Math.max(0, Math.min(5, Number(number[0]))) : 0,
    summary: cleaned.slice(0, 120) || "（AI 返回无法解析）",
  };
}

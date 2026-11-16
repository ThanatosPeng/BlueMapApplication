import type { GraphNode } from "../domain/types";

/** 让 AI 出 3 道递进题：概念 → 应用 → 踩坑 */
export function buildQuizPrompt(node: Pick<GraphNode, "title" | "sub" | "desc">): string {
  return [
    `你在考我是否真的掌握了「${node.title}」（${node.sub}）。`,
    node.desc ? `节点说明：${node.desc}` : "",
    "请出 3 道题，难度递进：第 1 题考核心概念，第 2 题考实际应用，第 3 题考常见坑。",
    "只输出 JSON 数组，形如 [\"题目1\",\"题目2\",\"题目3\"]，不要解释、不要 Markdown 代码块。",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 容错解析：模型偶尔会包代码块或带前后文字 */
export function parseQuiz(text: string): string[] {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    const parsed = JSON.parse(slice) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) =>
          typeof item === "string"
            ? item
            : typeof item === "object" && item && "q" in item
              ? String((item as { q: unknown }).q)
              : "",
        )
        .filter((item) => item.trim().length > 0)
        .slice(0, 5);
    }
  } catch {
    // 兜底：按行切
  }

  return cleaned
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.、)]+/, "").trim())
    .filter((line) => line.length > 4)
    .slice(0, 5);
}

export function buildGradePrompt(
  node: Pick<GraphNode, "title" | "sub">,
  qa: { q: string; a: string }[],
): string {
  const answers = qa.map((item, i) => `${i + 1}. 问：${item.q}\n   答：${item.a || "（未作答）"}`).join("\n");
  return [
    `你在评估我对「${node.title}」（${node.sub}）的掌握程度。`,
    answers,
    "按 0-5 打分：0 完全不会、2 能背概念、3 能在给定场景做对、4 能迁移到新场景、5 能讲清并回答追问。",
    "只输出 JSON：{\"score\": 0-5 的数字, \"summary\": \"一句话点评，指出最该补的点\"}，不要 Markdown。",
  ].join("\n");
}

export function parseGrade(text: string): { score: number; summary: string } {
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
    // 落到下面的兜底
  }

  const number = cleaned.match(/\d/);
  return {
    score: number ? Math.max(0, Math.min(5, Number(number[0]))) : 0,
    summary: cleaned.slice(0, 120) || "（AI 返回无法解析）",
  };
}

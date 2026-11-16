import { statusOf } from "../domain/mastery";
import type { Blueprint, NodeState } from "../domain/types";

export interface AIConfig {
  /** 默认走本机代理，避免浏览器直连被 CORS 拦 */
  baseURL: string;
  model: string;
  key: string;
}

export const DEFAULT_AI: AIConfig = {
  baseURL: "/api/deepseek",
  model: "deepseek-chat",
  key: "",
};

export interface AIProvider {
  readonly configured: boolean;
  /** 返回一段纯文本建议（3 行以内），失败时抛错由 UI 兜底 */
  suggest(prompt: string): Promise<string>;
}

/**
 * 把当前图谱压缩成一段可读的上下文。
 * 只给「已掌握 / 学习中 / 可学未开始」三组标题，不给全文描述 —— 省 token，也避免模型顺着描述编。
 */
export function buildLearningPrompt(
  bp: Blueprint,
  states: Record<string, NodeState>,
): string {
  const mastered: string[] = [];
  const learning: string[] = [];
  const available: string[] = [];

  for (const node of bp.nodes) {
    const mastery = states[node.id]?.mastery ?? 0;
    if (mastery >= 4) mastered.push(node.title);
    else if (mastery > 0) learning.push(`${node.title} ${mastery}/5`);
    else if (statusOf(node.id, bp.edges, states) === "available") available.push(node.title);
  }

  return [
    `学习蓝图：《${bp.title}》`,
    `目标：${bp.goal}`,
    `已掌握：${mastered.join("、") || "无"}`,
    `学习中：${learning.join("、") || "无"}`,
    `可学未开始：${available.join("、") || "无"}`,
    "",
    "请给出 3 条下一步建议，每条一行，格式：建议｜理由（理由不超过 30 字）。",
    "不要寒暄，不要重复我给的名单，不要输出编号以外的解释。",
  ].join("\n");
}

export function describeAIError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (msg === "NO_KEY") return "还没有填写 API Key，点「配置」填入后即可使用。";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return "请求没有发出去：代理未启动、网络不通，或 Key 被服务端拒绝。检查 vite 的 /api/deepseek 代理。";
  }
  if (msg.startsWith("HTTP 401")) return "Key 无效或已过期（401）。";
  if (msg.startsWith("HTTP 402")) return "账户余额不足（402）。";
  if (msg.startsWith("HTTP 429")) return "请求太频繁（429），稍后再试。";
  return msg;
}

import type { AIConfig, AIProvider } from "./provider";

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** 浏览器里走 Vite 代理；桌面端由主进程直连，所以相对路径要补成全域名 */
function resolveBaseURL(baseURL: string, viaDesktop: boolean): string {
  if (/^https?:\/\//i.test(baseURL)) return baseURL;
  if (viaDesktop) return "https://api.deepseek.com";
  return baseURL;
}

/**
 * DeepSeek（OpenAI 兼容协议）。
 *
 * - 浏览器：请求 `/api/deepseek/chat/completions`，由 Vite 代理转发，避免 CORS；
 * - Electron：`window.bluemap.aiRequest` 交给主进程 `net.fetch`，没有 CORS 也没有代理。
 *
 * Key 由用户自己填，存在本机。
 */
export function createDeepSeek(config: AIConfig): AIProvider {
  const configured = Boolean(config.key && config.model && config.baseURL);

  return {
    configured,
    async suggest(prompt: string): Promise<string> {
      if (!config.key) throw new Error("NO_KEY");

      const payload = {
        model: config.model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "你是一个务实的软件学习教练。只给可执行的建议，不寒暄，不重复用户的话。",
          },
          { role: "user", content: prompt },
        ],
      };

      const bridge = typeof window !== "undefined" ? window.bluemap : undefined;

      if (bridge?.aiRequest) {
        const base = resolveBaseURL(config.baseURL, true).replace(/\/+$/, "");
        const result = await bridge.aiRequest({
          url: `${base}/chat/completions`,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.key}`,
          },
          body: JSON.stringify(payload),
        });
        if (!result.ok) {
          const detail = result.text ? `：${result.text.slice(0, 160)}` : "";
          throw new Error(`HTTP ${result.status}${detail}`);
        }
        const data = JSON.parse(result.text) as ChatResponse;
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("EMPTY_RESPONSE");
        return content.trim();
      }

      const res = await fetch(`${config.baseURL.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.key}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.text()).slice(0, 160);
        } catch {
          /* 忽略读取失败的 body */
        }
        throw new Error(`HTTP ${res.status}${detail ? `：${detail}` : ""}`);
      }

      const data = (await res.json()) as ChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("EMPTY_RESPONSE");
      return content.trim();
    },
  };
}

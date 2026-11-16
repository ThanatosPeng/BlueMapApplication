import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeepSeek } from "./deepseek";
import { buildLearningPrompt, DEFAULT_AI, describeAIError } from "./provider";
import { SEED_BLUEPRINTS, seedNodeStates } from "../data";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deepseek provider", () => {
  it("reports unconfigured and refuses without a key", async () => {
    const provider = createDeepSeek({ ...DEFAULT_AI, key: "" });
    expect(provider.configured).toBe(false);
    await expect(provider.suggest("hi")).rejects.toThrow("NO_KEY");
  });

  it("posts through the proxy with auth header and trims the answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  建议A｜理由  " } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createDeepSeek({
      baseURL: "/api/deepseek/",
      model: "deepseek-chat",
      key: "sk-test",
    });
    expect(provider.configured).toBe(true);

    const out = await provider.suggest("hello");
    expect(out).toBe("建议A｜理由");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/deepseek/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(String(init.body)).model).toBe("deepseek-chat");
  });

  it("surfaces the HTTP status on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }),
    );
    const provider = createDeepSeek({ ...DEFAULT_AI, key: "k" });
    await expect(provider.suggest("x")).rejects.toThrow("HTTP 401");
  });

  it("rejects an empty completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }),
    );
    const provider = createDeepSeek({ ...DEFAULT_AI, key: "k" });
    await expect(provider.suggest("x")).rejects.toThrow("EMPTY_RESPONSE");
  });
});

describe("prompt building", () => {
  it("summarises the graph into three buckets", () => {
    const bp = SEED_BLUEPRINTS[0];
    const prompt = buildLearningPrompt(bp, seedNodeStates(bp));

    expect(prompt).toContain("《嵌入式》");
    expect(prompt).toContain("已掌握：");
    expect(prompt).toContain("学习中：");
    expect(prompt).toContain("可学未开始：");
    expect(prompt).toContain("3 条下一步建议");
    // 只给标题，不给完整描述 —— 防止模型顺着描述编
    expect(prompt).not.toContain("指针、结构体对齐");
  });
});

describe("error messages", () => {
  it("maps common failures to human sentences", () => {
    expect(describeAIError(new Error("NO_KEY"))).toContain("API Key");
    expect(describeAIError(new TypeError("Failed to fetch"))).toContain("代理");
    expect(describeAIError(new Error("HTTP 401：bad"))).toContain("401");
    expect(describeAIError(new Error("HTTP 402"))).toContain("余额");
    expect(describeAIError(new Error("HTTP 429"))).toContain("频繁");
  });
});

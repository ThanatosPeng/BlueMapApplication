import { describe, expect, it } from "vitest";
import { buildExpandPrompt, parseDrafts } from "./expand";
import { SEED_BLUEPRINTS } from "../data";

const bp = SEED_BLUEPRINTS[0];
const node = bp.nodes.find((n) => n.id === "emb-rtos")!;

describe("expand prompt", () => {
  it("carries the node context and the JSON contract", () => {
    const prompt = buildExpandPrompt(node, bp);
    expect(prompt).toContain("「FreeRTOS 任务与同步」");
    expect(prompt).toContain("《嵌入式》");
    expect(prompt).toContain("3–5 个");
    expect(prompt).toContain('{"title"');
    expect(prompt).toContain("前置知识：外设驱动");
  });
});

describe("parseDrafts", () => {
  it("parses a bare JSON array", () => {
    const result = parseDrafts('[{"title":"任务创建","sub":"xTaskCreate","hours":3}]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.drafts).toHaveLength(1);
      expect(result.drafts[0].title).toBe("任务创建");
    }
  });

  it("unwraps a fenced JSON block", () => {
    const text = '好的，拆解如下：\n```json\n[{"title":"队列","hours":2}]\n```\n希望有用。';
    const result = parseDrafts(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.drafts[0].title).toBe("队列");
  });

  it("finds the array inside surrounding prose", () => {
    const result = parseDrafts('结果：[{"title":"信号量"}] 以上。');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.drafts[0].sub).toBe("");
  });

  it("rejects non-JSON", () => {
    const result = parseDrafts("抱歉，我无法完成这个请求。");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("JSON");
  });

  it("rejects over-long lists and empty titles", () => {
    const tooMany = `[${Array.from({ length: 8 }, (_, i) => `{"title":"n${i}"}`).join(",")}]`;
    expect(parseDrafts(tooMany).ok).toBe(false);
    expect(parseDrafts('[{"title":""}]').ok).toBe(false);
  });
});

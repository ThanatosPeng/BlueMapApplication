import { describe, expect, it } from "vitest";
import { buildArtifactPrompt, parseArtifactReview } from "./artifactReview";
import type { ArtifactRef } from "../domain/types";

const node = { title: "FreeRTOS 任务与同步", sub: "任务、队列" };
const artifact: ArtifactRef = {
  kind: "repo",
  ref: "https://github.com/me/rtos-demo",
  label: "RTOS 调度演示",
  content: "用双任务 + 队列实现的串口日志系统",
  at: 1,
};

describe("作品 AI 评估", () => {
  it("prompt 里带上节点、作品与内容摘要", () => {
    const prompt = buildArtifactPrompt(node, artifact);
    expect(prompt).toContain("FreeRTOS 任务与同步");
    expect(prompt).toContain("rtos-demo");
    expect(prompt).toContain("双任务");
    expect(prompt).toContain("score");
  });

  it("没给内容时提示只能凭描述判断", () => {
    const prompt = buildArtifactPrompt(node, { ...artifact, content: undefined });
    expect(prompt).toContain("没有提供内容");
  });

  it("解析 JSON 评分并夹在 0-5", () => {
    expect(parseArtifactReview('{"score":4,"summary":"能跑"}')).toEqual({
      score: 4,
      summary: "能跑",
    });
    expect(parseArtifactReview('{"score":7,"summary":"x"}').score).toBe(5);
    expect(parseArtifactReview('{"score":-2,"summary":"x"}').score).toBe(0);
  });

  it("对被包了代码块或带解释的输出也能解析", () => {
    const text = '好的，我的评估：\n```json\n{"score":3,"summary":"还停留在照抄"}\n```';
    expect(parseArtifactReview(text)).toEqual({ score: 3, summary: "还停留在照抄" });
  });

  it("完全无法解析时给 0 分而不是崩掉", () => {
    const result = parseArtifactReview("我觉得还行吧");
    expect(result.score).toBe(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

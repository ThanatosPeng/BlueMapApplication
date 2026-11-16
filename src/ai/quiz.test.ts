import { describe, expect, it } from "vitest";
import { buildGradePrompt, buildQuizPrompt, parseGrade, parseQuiz } from "./quiz";

const node = { title: "FreeRTOS 任务与同步", sub: "任务、队列", desc: "优先级怎么定" };

describe("AI 问答", () => {
  it("prompt 里带上节点信息并要求 3 道递进题", () => {
    const prompt = buildQuizPrompt(node);
    expect(prompt).toContain("FreeRTOS 任务与同步");
    expect(prompt).toContain("3 道题");
    expect(prompt).toContain("JSON");
  });

  it("parseQuiz 能吃裸数组、代码块、对象数组", () => {
    expect(parseQuiz('["Q1","Q2","Q3"]')).toEqual(["Q1", "Q2", "Q3"]);
    expect(parseQuiz('```json\n["A","B"]\n```')).toEqual(["A", "B"]);
    expect(parseQuiz('[{"q":"X"},{"q":"Y"}]')).toEqual(["X", "Y"]);
  });

  it("parseQuiz 在非 JSON 时按行兜底", () => {
    const lines = parseQuiz("1. 什么是任务优先级？\n2. 队列满了怎么办？");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("任务优先级");
  });

  it("parseGrade 解析分数并夹在 0-5", () => {
    expect(parseGrade('{"score":4,"summary":"还行"}')).toEqual({ score: 4, summary: "还行" });
    expect(parseGrade('{"score":9,"summary":"x"}').score).toBe(5);
    expect(parseGrade('{"score":-3,"summary":"x"}').score).toBe(0);
  });

  it("parseGrade 对垃圾输出不崩", () => {
    const result = parseGrade("我觉得你大概 3 分吧");
    expect(result.score).toBe(3);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("判分 prompt 会把问答都带进去", () => {
    const prompt = buildGradePrompt(node, [{ q: "Q1", a: "A1" }]);
    expect(prompt).toContain("Q1");
    expect(prompt).toContain("A1");
    expect(prompt).toContain("score");
  });
});

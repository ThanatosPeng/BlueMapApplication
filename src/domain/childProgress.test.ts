import { describe, expect, it } from "vitest";
import { childLinkForNode, isChildNodeDone, summarizeChild } from "./childProgress";
import type { Blueprint, ProgressDoc } from "./types";
import type { CrossLink } from "./links";

const doc: Blueprint = {
  id: "child-1",
  title: "子图",
  goal: "",
  parentId: "emb",
  nodes: [
    { id: "a", title: "任务创建", sub: "", type: "concept", tier: 0, row: 0, desc: "", resources: [] },
    { id: "b", title: "队列", sub: "", type: "concept", tier: 0, row: 1, desc: "", resources: [] },
    { id: "c", title: "信号量", sub: "", type: "concept", tier: 0, row: 2, desc: "", resources: [] },
  ],
  edges: [],
};

const progress = (masteries: Record<string, number>): ProgressDoc => ({
  nodes: Object.fromEntries(
    Object.entries(masteries).map(([id, mastery]) => [
      id,
      {
        mastery: mastery as 0 | 1 | 2 | 3 | 4 | 5,
        note: "",
        dueAt: null,
        intervalDays: 0,
        evidence: { self: false, quiz: false, artifact: false, ai: false },
        litAt: null,
      },
    ]),
  ),
  pos: {},
});

describe("child blueprint summary", () => {
  it("caps done at mastery 4", () => {
    expect(isChildNodeDone(3)).toBe(false);
    expect(isChildNodeDone(4)).toBe(true);
  });

  it("counts done nodes and averages mastery", () => {
    const summary = summarizeChild("child-1", doc, progress({ a: 5, b: 4, c: 0 }));
    expect(summary.total).toBe(3);
    expect(summary.doneCount).toBe(2);
    expect(summary.allDone).toBe(false);
    // (5 + 4 + 0) / (3 * 5) = 60%
    expect(summary.percent).toBe(60);
  });

  it("marks allDone only when every node is lit", () => {
    const partial = summarizeChild("child-1", doc, progress({ a: 4, b: 4, c: 3 }));
    const full = summarizeChild("child-1", doc, progress({ a: 4, b: 5, c: 4 }));
    expect(partial.allDone).toBe(false);
    expect(full.allDone).toBe(true);
    expect(full.percent).toBe(87); // (4+5+4)/15 ≈ 86.7
  });

  it("treats an empty child as not done", () => {
    const empty: Blueprint = { ...doc, nodes: [], edges: [] };
    const summary = summarizeChild("empty", empty, { nodes: {}, pos: {} });
    expect(summary.allDone).toBe(false);
    expect(summary.percent).toBe(0);
  });
});

describe("childLinkForNode", () => {
  const links: CrossLink[] = [
    { id: "l1", fromBp: "emb", fromNode: "emb-rtos", toBp: "child-1", toNode: "" },
    { id: "l2", fromBp: "emb", fromNode: "emb-c", toBp: "react", toNode: "re-core" },
  ];

  it("finds the blueprint-level link hanging off a node", () => {
    expect(childLinkForNode(links, "emb", "emb-rtos")?.toBp).toBe("child-1");
  });

  it("ignores node-to-node links", () => {
    expect(childLinkForNode(links, "emb", "emb-c")).toBeNull();
    expect(childLinkForNode(links, "emb", "emb-gpio")).toBeNull();
  });
});

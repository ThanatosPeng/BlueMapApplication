import { describe, expect, it } from "vitest";
import { buildBundle, parseBundle } from "./serialize";
import { SEED_BLUEPRINTS, seedNodeStates } from "../data";

const bp = SEED_BLUEPRINTS[0];

function sampleBundle() {
  return buildBundle([
    { doc: bp, progress: { nodes: seedNodeStates(bp), pos: { "emb-c": { x: 1, y: 2 } } } },
  ]);
}

describe("serialize", () => {
  it("round-trips a bundle", () => {
    const bundle = sampleBundle();
    const result = parseBundle(JSON.stringify(bundle));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.blueprints).toHaveLength(1);
    expect(result.bundle.blueprints[0].doc.nodes).toHaveLength(bp.nodes.length);
    expect(result.bundle.blueprints[0].progress.nodes["emb-c"].mastery).toBe(4);
  });

  it("rejects malformed JSON", () => {
    const result = parseBundle("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("JSON");
  });

  it("rejects a wrong schema version", () => {
    const bad = { ...sampleBundle(), schemaVersion: 2 };
    const result = parseBundle(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });

  it("rejects dangling edges", () => {
    const bundle = sampleBundle();
    bundle.blueprints[0].doc.edges = [
      ...bundle.blueprints[0].doc.edges,
      { id: "x", from: "emb-c", to: "missing-node", kind: "hard" },
    ];
    const result = parseBundle(JSON.stringify(bundle));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("不存在");
  });

  it("rejects cyclic graphs", () => {
    const bundle = sampleBundle();
    bundle.blueprints[0].doc.edges = [
      { id: "a", from: "emb-c", to: "emb-gpio", kind: "hard" },
      { id: "b", from: "emb-gpio", to: "emb-c", kind: "hard" },
    ];
    const result = parseBundle(JSON.stringify(bundle));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("循环");
  });

  it("does not carry AI settings into the export", () => {
    const text = JSON.stringify(sampleBundle());
    expect(text).not.toContain("deepseek");
    expect(text).not.toContain("sk-");
  });
});

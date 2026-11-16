import { describe, expect, it } from "vitest";
import {
  linkCounts,
  linksForNode,
  makeLinkId,
  parentLinkFor,
  validateLink,
  type CrossLink,
} from "./links";
import { SEED_BLUEPRINTS } from "../data";
import type { Blueprint } from "./types";

const index = new Map<string, Blueprint>(SEED_BLUEPRINTS.map((b) => [b.id, b]));
const emb = SEED_BLUEPRINTS.find((b) => b.id === "emb")!;
const react = SEED_BLUEPRINTS.find((b) => b.id === "react")!;

const link = (
  fromBp: string,
  fromNode: string,
  toBp: string,
  toNode: string,
): CrossLink => ({ id: makeLinkId(fromBp, fromNode, toBp, toNode), fromBp, fromNode, toBp, toNode });

describe("cross links", () => {
  it("builds a stable id", () => {
    expect(makeLinkId("emb", "emb-c", "react", "re-ts")).toBe("emb:emb-c=>react:re-ts");
  });

  it("accepts a link between two existing nodes", () => {
    expect(validateLink(link("emb", emb.nodes[0].id, "react", react.nodes[0].id), index)).toBeNull();
  });

  it("rejects unknown blueprints and nodes", () => {
    expect(validateLink(link("nope", "x", "react", react.nodes[0].id), index)).toContain("蓝图");
    expect(validateLink(link("emb", "ghost", "react", react.nodes[0].id), index)).toContain("起点");
    expect(validateLink(link("emb", emb.nodes[0].id, "react", "ghost"), index)).toContain("终点");
  });

  it("rejects self links", () => {
    const node = emb.nodes[0].id;
    expect(validateLink(link("emb", node, "emb", node), index)).toContain("自己");
  });

  it("splits inbound and outbound for a node", () => {
    const links: CrossLink[] = [
      link("emb", "emb-c", "react", "re-core"),
      link("react", "re-core", "emb", "emb-c"),
      link("emb", "emb-gpio", "react", "re-core"),
    ];
    const result = linksForNode(links, "emb", "emb-c");
    expect(result.outbound).toHaveLength(1);
    expect(result.inbound).toHaveLength(1);
  });

  it("counts links per node on both ends", () => {
    const links: CrossLink[] = [
      link("emb", "emb-c", "react", "re-core"),
      link("emb", "emb-gpio", "react", "re-core"),
    ];
    const counts = linkCounts(links);
    expect(counts.get("emb:emb-c")).toBe(1);
    expect(counts.get("react:re-core")).toBe(2);
  });

  it("finds the parent link of a child blueprint", () => {
    const links: CrossLink[] = [
      link("emb", "emb-rtos", "child-1", ""),
      link("emb", "emb-c", "react", "re-core"),
    ];
    const parent = parentLinkFor(links, "child-1");
    expect(parent?.fromNode).toBe("emb-rtos");
    expect(parent?.fromBp).toBe("emb");
    expect(parentLinkFor(links, "emb")).toBeNull();
  });

  it("accepts blueprint-level links without a target node", () => {
    const child: Blueprint = {
      id: "child-1",
      title: "子图",
      goal: "",
      parentId: "emb",
      nodes: [],
      edges: [],
    };
    const withChild = new Map([...index, ["child-1", child]]);
    expect(validateLink(link("emb", "emb-rtos", "child-1", ""), withChild)).toBeNull();
  });
});

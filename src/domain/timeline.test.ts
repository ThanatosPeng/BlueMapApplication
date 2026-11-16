import { describe, expect, it } from "vitest";
import {
  litIdsAt,
  litMoments,
  progressAtTime,
  timeAtProgress,
  timelineRange,
} from "./timeline";
import type { NodeState } from "./types";

const DAY = 86400000;
const now = Date.UTC(2026, 10, 13);

const state = (litAt: number | null, mastery = 4): NodeState => ({
  mastery,
  note: "",
  dueAt: null,
  intervalDays: 7,
  evidence: { self: false, quiz: false, artifact: false, ai: false },
  litAt,
});

describe("timeline", () => {
  const states: Record<string, NodeState> = {
    a: state(now - 5 * DAY),
    b: state(now - 3 * DAY),
    c: state(now - 1 * DAY),
    d: state(null, 1),
  };

  it("orders lit moments by time and ignores unlit nodes", () => {
    const moments = litMoments(states);
    expect(moments.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(moments[0].at).toBeLessThan(moments[1].at);
  });

  it("builds a range that ends at now", () => {
    const range = timelineRange(states, now)!;
    expect(range.start).toBe(now - 5 * DAY);
    expect(range.end).toBe(now);
    expect(range.count).toBe(3);
  });

  it("returns null when there is nothing to replay", () => {
    expect(timelineRange({ a: state(null, 0) }, now)).toBeNull();
    expect(timelineRange({ a: state(now) }, now)).toBeNull();
  });

  it("counts nodes lit at a given moment", () => {
    expect(litIdsAt(states, now - 4 * DAY).size).toBe(1);
    expect(litIdsAt(states, now - 2 * DAY).size).toBe(2);
    expect(litIdsAt(states, now).size).toBe(3);
    expect(litIdsAt(states, now - 10 * DAY).size).toBe(0);
  });

  it("maps progress to time and back", () => {
    const range = timelineRange(states, now)!;
    const mid = timeAtProgress(range, 0.5);
    expect(mid).toBe((range.start + range.end) / 2);
    expect(progressAtTime(range, mid)).toBeCloseTo(0.5, 5);
    expect(progressAtTime(range, range.start - 1000)).toBe(0);
    expect(progressAtTime(range, range.end + 1000)).toBe(1);
  });
});

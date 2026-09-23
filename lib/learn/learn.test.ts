import { describe, expect, it } from "vitest";
import { crossCheckApproach, readsComplete } from "./mcq";
import { selectStrategy } from "./prompt";
import type { FeedEntry, TrajectoryItem } from "./types";

const read = (title: string, n: number): TrajectoryItem => ({ id: `t:m1#s${n}`, kind: "read", title, content: `why ${title}`, revealed: true });
const traj: TrajectoryItem[] = [
  { id: "t:m1#s0", kind: "reasoning", title: "Thinking", content: "", revealed: true },
  read("package.json", 1),
  read("lib/db.ts", 2),
  read("app/api/notes/route.ts", 3),
  { id: "t:m1#s4", kind: "plan", title: "Plan", content: "", revealed: false },
];
const options = ["package.json", "lib/db.ts", "app/api/notes/route.ts", "app/globals.css", "public/logo.svg"];

describe("approach MCQ cross-check (answer key = files the main agent read)", () => {
  it("is correct when picks are all real reads", () => {
    expect(crossCheckApproach(["package.json", "lib/db.ts"], options, traj).verdict).toBe("correct");
  });
  it("is partial when mixing hits and misses", () => {
    expect(crossCheckApproach(["lib/db.ts", "app/globals.css"], options, traj).verdict).toBe("partial");
  });
  it("is incorrect with no hits", () => {
    expect(crossCheckApproach(["public/logo.svg"], options, traj).verdict).toBe("incorrect");
  });
  it("returns the actual reads with anchors", () => {
    const r = crossCheckApproach([], options, traj);
    expect(r.actual.map((a) => a.itemId)).toEqual(["t:m1#s1", "t:m1#s2", "t:m1#s3"]);
  });
  it("waits until the agent moves past its reads", () => {
    expect(readsComplete(traj, false)).toBe(false);
    expect(readsComplete(traj.map((i) => (i.kind === "plan" ? { ...i, revealed: true } : i)), false)).toBe(true);
    expect(readsComplete(traj, true)).toBe(true);
  });
});

describe("strategy selection", () => {
  const fb = (verdict: "correct" | "incorrect"): FeedEntry => ({ kind: "feedback", probeId: "p", verdict, text: "", anchors: [], misconceptionTag: "", at: 1 });
  it("pre-empts while the main agent works", () => {
    expect(selectStrategy([], "working")).toMatch(/pre-emption/);
  });
  it("hints after one miss, explains after two", () => {
    expect(selectStrategy([fb("incorrect")], "done")).toMatch(/hint/);
    expect(selectStrategy([fb("incorrect"), fb("incorrect")], "done")).toMatch(/explain/);
  });
  it("deepens after a correct answer", () => {
    expect(selectStrategy([fb("correct")], "done")).toMatch(/what_if/);
  });
});

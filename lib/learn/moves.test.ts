import { describe, expect, it } from "vitest";
import type { ThreadItem } from "@/lib/thread/types";
import { arcOf, breadcrumb, nextMoves, openProbe, pendingNudge } from "./moves";
import { mockGrade } from "./mock";
import type { FeedEntry, LearnAction, LearnSession } from "./types";

const probe = (id: string, over: Partial<Extract<LearnAction, { kind: "probe" }>> = {}): FeedEntry => ({
  kind: "action",
  at: 1,
  action: { kind: "probe", id, mode: "predict", format: "free_text", question: "q", options: [], topicId: "jwt", anchors: [], rubric: "r", concept: `c-${id}`, deeper: `d-${id}`, sibling: `s-${id}`, ...over },
});
const answer = (probeId: string, at = 2): FeedEntry => ({ kind: "answer", probeId, text: "a", selected: [], at });
const graded = (probeId: string, verdict: "correct" | "incorrect"): FeedEntry => ({ kind: "feedback", probeId, verdict, text: "", anchors: [], misconceptionTag: "", at: 3 });
const hint: FeedEntry = { kind: "action", at: 4, action: { kind: "hint", text: "h", topicId: "jwt", anchors: [] } };

const session = (feed: FeedEntry[], over: Partial<LearnSession> = {}): LearnSession => ({
  id: "s",
  threadId: "t",
  messageId: "m1",
  trigger: "live",
  topics: [],
  objective: { topicId: "jwt", label: "Explain JWT checks", why: "now" },
  objectiveAt: 0,
  feed,
  widgets: {},
  moveTarget: 3,
  actedNudges: [],
  busy: false,
  ended: false,
  startedAt: 0,
  ...over,
});

describe("open question", () => {
  it("is open until answered, and reopens after a hint", () => {
    expect(openProbe([probe("p1")])).not.toBeNull();
    expect(openProbe([probe("p1"), answer("p1"), graded("p1", "incorrect")])).toBeNull();
    expect(openProbe([probe("p1"), answer("p1"), graded("p1", "incorrect"), hint])?.id).toBe("p1");
    expect(openProbe([probe("p1"), answer("p1"), graded("p1", "incorrect"), hint, answer("p1", 5)])).toBeNull();
  });
});

describe("next moves (never an empty box)", () => {
  it("after a correct answer: dig deeper (labelled with the target), hands-on, zoom out", () => {
    const moves = nextMoves(session([probe("p1"), answer("p1"), graded("p1", "correct")]), [probe("p1"), answer("p1"), graded("p1", "correct")]);
    expect(moves.map((m) => m.move)).toEqual(["dig_deeper", "hands_on", "zoom_out"]);
    expect(moves[0].target).toBe("d-p1");
    expect(moves[2].target).toBe("s-p1");
  });
  it("after a miss: hint, see how it works (interactive), show me in Claude's code", () => {
    const f = [probe("p1"), answer("p1"), graded("p1", "incorrect")];
    expect(nextMoves(session(f), f).map((m) => m.move)).toEqual(["hint", "explain", "show_code"]);
  });
  it("while a question is open: stuck options, without a second hint", () => {
    expect(nextMoves(session([probe("p1")]), [probe("p1")]).map((m) => m.move)).toEqual(["hint", "easier", "show_code"]);
    const f = [probe("p1"), answer("p1"), graded("p1", "incorrect"), hint];
    expect(nextMoves(session(f), f).map((m) => m.move)).toEqual(["easier", "show_code"]);
  });
  it("offers nothing before a goal is chosen or after the recap", () => {
    expect(nextMoves(session([], { objective: null }), [])).toEqual([]);
    expect(nextMoves(session([probe("p1")], { ended: true }), [probe("p1")])).toEqual([]);
  });
});

describe("arc and breadcrumb", () => {
  it("counts answered questions against the target", () => {
    const f = [probe("p1"), answer("p1"), probe("p2"), answer("p2")];
    expect(arcOf(session(f), f)).toEqual({ done: 2, target: 3, complete: false });
  });
  it("builds a de-duplicated concept trail", () => {
    expect(breadcrumb([probe("p1"), probe("p2"), probe("p1")])).toEqual(["c-p1", "c-p2"]);
  });
});

describe("proactive nudges", () => {
  const item = (id: string, kind: ThreadItem["kind"], revealedAt: number, title = id): ThreadItem => ({ id, threadId: "t", messageId: "m1", kind, title, content: "", revealed: true, revealedAt });
  it("prompts a prediction check when Claude writes the predicted step", () => {
    const f = [probe("p1", { anchors: ["t:m1#s7"] }), answer("p1", 100)];
    const n = pendingNudge(session(f), [item("t:m1#s7", "file", 200, "lib/auth.ts")]);
    expect(n).toMatchObject({ key: "pred:p1", probeId: "p1", cta: "Check my prediction" });
    expect(pendingNudge(session(f, { actedNudges: ["pred:p1"] }), [item("t:m1#s7", "file", 200, "lib/auth.ts")])).toBeNull();
  });
  it("matches a prediction to the file its question names, even with no anchor yet", () => {
    const f = [probe("p1", { question: "Claude is about to write `verifyToken()` in `lib/auth.ts`. What must it check?" }), answer("p1", 100)];
    expect(pendingNudge(session(f), [item("t:m1#s7", "file", 200, "lib/auth.ts")])).toMatchObject({ key: "pred:p1", itemTitle: "lib/auth.ts" });
  });
  it("otherwise offers a question on the newest file written after the goal was chosen", () => {
    const n = pendingNudge(session([], { objectiveAt: 50 }), [item("a", "file", 10), item("b", "file", 60, "middleware.ts"), item("c", "read", 70)]);
    expect(n).toMatchObject({ key: "step:b", probeId: null, itemTitle: "middleware.ts" });
  });
});

describe("mock grader", () => {
  it("grades by overlap with the rubric's key terms", () => {
    const p = (probe("p", { rubric: "Verify the signature with the server secret; check expiry (exp); pin the allowed algorithm." }) as Extract<FeedEntry, { kind: "action" }>).action as Extract<LearnAction, { kind: "probe" }>;
    expect(mockGrade({ probe: p, answer: "check the signature using the secret and the expiry", trajectory: [] }).verdict).toBe("correct");
    expect(mockGrade({ probe: p, answer: "the signature", trajectory: [] }).verdict).toBe("partial");
    expect(mockGrade({ probe: p, answer: "no idea", trajectory: [] }).verdict).toBe("incorrect");
  });
});

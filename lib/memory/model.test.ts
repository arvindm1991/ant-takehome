import { describe, expect, it } from "vitest";
import { advanceClock, applyEvidence, applyReviewOutcome, contextualRefresher, dueRefreshers, DAY, INTERVAL_DAYS, learnerStateFor, nextEstimate, PRIOR, scheduleReview, snoozeRefresher } from "./model";
import { emptyMemory } from "./types";
import type { EvidenceInput } from "./model";

const ev = (over: Partial<EvidenceInput> = {}): EvidenceInput => ({
  id: `p1#1`,
  topicId: "jwt",
  sessionId: "s1",
  threadId: "t1",
  threadItemRefs: [],
  probe: "q",
  mode: "predict",
  answer: "a",
  verdict: "correct",
  hinted: false,
  ...over,
});

describe("mastery update (SPEC §10.1)", () => {
  it("moves toward the target by α", () => {
    expect(nextEstimate(PRIOR, "correct", "predict", false)).toBeCloseTo(0.3 + 0.35 * 0.7, 3);
    expect(nextEstimate(0.5, "incorrect", "explain_back", false)).toBeCloseTo(0.375, 3);
    expect(nextEstimate(0.5, "partial", "what_if", false)).toBeCloseTo(0.5, 3);
  });
  it("gives less credit when hinted", () => {
    expect(nextEstimate(PRIOR, "correct", "predict", true)).toBeLessThan(nextEstimate(PRIOR, "correct", "predict", false));
  });
  it("records evidence idempotently and normalizes topic ids", () => {
    let m = applyEvidence(emptyMemory(), ev({ topicId: "JWT Auth" }));
    m = applyEvidence(m, ev({ topicId: "JWT Auth" }));
    expect(m.evidence).toHaveLength(1);
    expect(m.mastery["jwt-auth"].attempts).toBe(1);
  });
  it("tracks and resolves misconceptions", () => {
    let m = applyEvidence(emptyMemory(), ev({ verdict: "incorrect", misconceptionTag: "payload-is-encrypted" }));
    expect(m.misconceptions[0].resolved).toBe(false);
    m = { ...m, timeOffsetMs: 1000 };
    m = applyEvidence(m, ev({ id: "p2#1", verdict: "correct" }));
    expect(m.misconceptions[0].resolved).toBe(true);
  });
});

describe("spaced repetition (SPEC §10.2)", () => {
  it("schedules the first review a day out, then advances on correct and resets on incorrect", () => {
    let m = scheduleReview(applyEvidence(emptyMemory(), ev()), ["jwt"]);
    const due1 = m.mastery.jwt.nextDue! - Date.now();
    expect(Math.round(due1 / DAY)).toBe(INTERVAL_DAYS[0]);
    m = applyReviewOutcome(m, "jwt", "correct");
    expect(Math.round((m.mastery.jwt.nextDue! - Date.now()) / DAY)).toBe(INTERVAL_DAYS[1]);
    m = applyReviewOutcome(m, "jwt", "incorrect");
    expect(m.mastery.jwt.intervalIdx).toBe(0);
  });
});

describe("learner state for the LSA context", () => {
  it("reports bands, misconceptions and recent evidence", () => {
    const m = applyEvidence(emptyMemory(), ev({ verdict: "incorrect", misconceptionTag: "x" }));
    const s = learnerStateFor(m, ["jwt", "password-hashing"]);
    expect(s.topics[0]).toMatchObject({ id: "jwt", attempts: 1, openMisconceptions: ["x"] });
    expect(s.topics[1]).toMatchObject({ id: "password-hashing", estimate: null, band: "new" });
    expect(s.evidence).toHaveLength(1);
  });
});


describe("refreshers (SPEC §10.3)", () => {
  const learned = () =>
    scheduleReview(applyEvidence(emptyMemory(), ev({ verdict: "partial", threadItemRefs: ["t1:m1#s7"] })), ["jwt"]);
  it("keep their source even when the evidence had no anchors", () => {
    const m = advanceClock(scheduleReview(applyEvidence(emptyMemory(), ev({ verdict: "partial", messageId: "m2" })), ["jwt"]), 3);
    expect(dueRefreshers(m)[0].source).toMatchObject({ threadId: "t1", messageId: "m2" });
  });
  it("become due after the interval passes on the simulated clock", () => {
    expect(dueRefreshers(learned())).toHaveLength(0);
    const due = dueRefreshers(advanceClock(learned(), 3));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ topicId: "jwt", daysSince: 3, source: { threadId: "t1", messageId: "m1" } });
  });
  it("can be dismissed for a day without resetting the review schedule", () => {
    const m = advanceClock(learned(), 3);
    const snoozed = snoozeRefresher(m, "jwt");
    expect(dueRefreshers(snoozed)).toHaveLength(0);
    expect(snoozed.mastery.jwt.intervalIdx).toBe(m.mastery.jwt.intervalIdx);
    expect(dueRefreshers(advanceClock(snoozed, 1))).toHaveLength(1);
  });
  it("prefer direct recurrence over interleaving", () => {
    const m = learned();
    expect(contextualRefresher(m, [{ id: "jwt" }], ["x"])).toMatchObject({ topicId: "jwt", interleave: false });
    expect(contextualRefresher(m, [{ id: "rate-limiting" }], ["jwt"])).toMatchObject({ topicId: "jwt", interleave: true });
    expect(contextualRefresher(m, [{ id: "rate-limiting" }], [])).toBeNull();
  });
  it("stop interleaving nudges after repeated dismissals", () => {
    const m = { ...learned(), preferences: { shown: {}, engaged: {}, dismissals: 3 } };
    expect(contextualRefresher(m, [{ id: "rate-limiting" }], ["jwt"])).toBeNull();
    expect(contextualRefresher(m, [{ id: "jwt" }], [])).not.toBeNull();
  });
});

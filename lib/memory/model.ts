// Pure learner-memory updates (SPEC §10.1–10.2). The LLM grades; this code decides
// what a grade means for mastery, misconceptions and the review schedule (D10).
import type { ProbeMode, Verdict } from "@/lib/learn/types";
import type { Episode, Evidence, LearnerMemory, MasteryRecord, TopicId } from "./types";

export const DAY = 24 * 60 * 60 * 1000;
export const PRIOR = 0.3; // estimate assumed before any evidence
export const INTERVAL_DAYS = [1, 3, 7, 16, 35];

export const now = (m: LearnerMemory) => Date.now() + m.timeOffsetMs;

const TARGET: Record<Verdict, number> = { correct: 1, partial: 0.5, incorrect: 0 };
const ALPHA: Record<ProbeMode, number> = { predict: 0.35, what_if: 0.35, explain_back: 0.25, approach: 0.25 };

/** estimate += α · (target − estimate); target ×0.7 when the learner needed a hint. */
export function nextEstimate(prev: number, verdict: Verdict, mode: ProbeMode, hinted: boolean): number {
  const target = TARGET[verdict] * (hinted ? 0.7 : 1);
  const e = prev + ALPHA[mode] * (target - prev);
  return Math.round(Math.min(1, Math.max(0, e)) * 1000) / 1000;
}

export type Band = "new" | "learning" | "developing" | "solid" | "mastered";
export function band(estimate: number | null | undefined): Band {
  if (estimate == null) return "new";
  if (estimate < 0.4) return "learning";
  if (estimate < 0.7) return "developing";
  if (estimate < 0.9) return "solid";
  return "mastered";
}
export const estimateOf = (m: LearnerMemory, id: TopicId) => m.mastery[id]?.estimate ?? null;

export const normalizeTopicId = (id: string) =>
  id
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "general";

export function ensureTopics(m: LearnerMemory, topics: { id: string; label: string }[]): LearnerMemory {
  const next = { ...m.topics };
  const ids = topics.map((t) => normalizeTopicId(t.id));
  topics.forEach((t, i) => {
    const id = ids[i];
    const related = ids.filter((x) => x !== id);
    const cur = next[id];
    next[id] = { label: cur?.label ?? t.label, related: [...new Set([...(cur?.related ?? []), ...related])] };
  });
  return { ...m, topics: next };
}

export type EvidenceInput = Omit<Evidence, "estimateAfter" | "ts" | "topicId"> & { topicId: string; topicLabel?: string };

/** Record one graded attempt. Idempotent on evidence id. */
export function applyEvidence(m: LearnerMemory, input: EvidenceInput): LearnerMemory {
  if (m.evidence.some((e) => e.id === input.id)) return m;
  const t = now(m);
  const topicId = normalizeTopicId(input.topicId);
  const withTopic = m.topics[topicId] ? m : ensureTopics(m, [{ id: topicId, label: input.topicLabel ?? topicId }]);
  const prev: MasteryRecord = withTopic.mastery[topicId] ?? { estimate: PRIOR, attempts: 0, lastSeen: t, nextDue: null, intervalIdx: 0 };
  const estimate = nextEstimate(prev.estimate, input.verdict, input.mode, input.hinted);

  let misconceptions = withTopic.misconceptions;
  if (input.verdict === "incorrect" && input.misconceptionTag) {
    const existing = misconceptions.find((x) => x.topicId === topicId && x.tag === input.misconceptionTag);
    misconceptions = existing
      ? misconceptions.map((x) => (x === existing ? { ...x, lastSeen: t, resolved: false } : x))
      : [...misconceptions, { topicId, tag: input.misconceptionTag, description: input.probe, firstSeen: t, lastSeen: t, resolved: false }];
  } else if (input.verdict === "correct") {
    // A later correct, unhinted answer on the topic resolves its open misconceptions.
    misconceptions = misconceptions.map((x) => (x.topicId === topicId && !x.resolved && !input.hinted && x.lastSeen < t ? { ...x, resolved: true } : x));
  }

  const evidence: Evidence = { ...input, topicId, estimateAfter: estimate, ts: t };
  return {
    ...withTopic,
    mastery: { ...withTopic.mastery, [topicId]: { ...prev, estimate, attempts: prev.attempts + 1, lastSeen: t } },
    evidence: [...withTopic.evidence, evidence],
    misconceptions,
  };
}

/** Schedule review for topics touched in a session (SPEC §10.2). */
export function scheduleReview(m: LearnerMemory, topicIds: TopicId[]): LearnerMemory {
  const t = now(m);
  const mastery = { ...m.mastery };
  for (const id of topicIds.map(normalizeTopicId)) {
    const r = mastery[id];
    if (!r) continue;
    mastery[id] = { ...r, nextDue: r.estimate < 0.9 ? t + INTERVAL_DAYS[Math.min(r.intervalIdx, INTERVAL_DAYS.length - 1)] * DAY : null };
  }
  return { ...m, mastery };
}

/** Advance/reset the interval after a refresher answer (used by refreshers, M5). */
export function applyReviewOutcome(m: LearnerMemory, topicId: TopicId, verdict: Verdict): LearnerMemory {
  const id = normalizeTopicId(topicId);
  const r = m.mastery[id];
  if (!r) return m;
  const intervalIdx = verdict === "correct" ? Math.min(r.intervalIdx + 1, INTERVAL_DAYS.length - 1) : verdict === "partial" ? r.intervalIdx : 0;
  return scheduleReview({ ...m, mastery: { ...m.mastery, [id]: { ...r, intervalIdx } } }, [id]);
}

/** "Not now" on an Inbox refresher: bring it back later without counting it as a review. */
export function snoozeRefresher(m: LearnerMemory, topicId: TopicId, days = 1): LearnerMemory {
  const id = normalizeTopicId(topicId);
  const r = m.mastery[id];
  if (!r) return m;
  return { ...m, mastery: { ...m.mastery, [id]: { ...r, nextDue: now(m) + days * DAY } } };
}

export function upsertEpisode(m: LearnerMemory, ep: Episode): LearnerMemory {
  const i = m.episodes.findIndex((e) => e.id === ep.id);
  const episodes = i >= 0 ? m.episodes.map((e, j) => (j === i ? ep : e)) : [...m.episodes, ep];
  return { ...m, episodes };
}

export function snapshot(m: LearnerMemory, topicIds: TopicId[]): Record<TopicId, number | null> {
  return Object.fromEntries(topicIds.map((id) => [normalizeTopicId(id), estimateOf(m, normalizeTopicId(id))]));
}

export function bump(m: LearnerMemory, kind: "shown" | "engaged", tool: string): LearnerMemory {
  const p = m.preferences;
  return { ...m, preferences: { ...p, [kind]: { ...p[kind], [tool]: (p[kind][tool] ?? 0) + 1 } } };
}

/** Compact learner state for the learning agent's context (SPEC §9.1). */
export function learnerStateFor(m: LearnerMemory, topicIds: TopicId[]) {
  const ids = [...new Set(topicIds.map(normalizeTopicId))];
  const t = now(m);
  return {
    topics: ids.map((id) => ({
      id,
      label: m.topics[id]?.label ?? id,
      estimate: estimateOf(m, id),
      attempts: m.mastery[id]?.attempts ?? 0,
      band: band(estimateOf(m, id)),
      openMisconceptions: m.misconceptions.filter((x) => x.topicId === id && !x.resolved).map((x) => x.tag),
    })),
    evidence: m.evidence
      .filter((e) => ids.includes(e.topicId))
      .slice(-6)
      .map((e) => ({ topicId: e.topicId, mode: e.mode, verdict: e.verdict, hinted: e.hinted, probe: e.probe, answer: e.answer, daysAgo: Math.round((t - e.ts) / DAY) })),
    knownTopics: Object.entries(m.topics).map(([id, v]) => ({ id, label: v.label, estimate: estimateOf(m, id) })),
  };
}
export type LearnerState = ReturnType<typeof learnerStateFor>;

export type Refresher = {
  topicId: TopicId;
  label: string;
  estimate: number;
  dueAt: number;
  daysSince: number;
  source: { threadId: string; messageId: string; threadTitle: string } | null;
};

/** Due + not yet solid → Inbox / badge (SPEC §10.3 trigger 3). */
export function dueRefreshers(m: LearnerMemory): Refresher[] {
  const t = now(m);
  return Object.entries(m.mastery)
    .filter(([, r]) => r.nextDue != null && r.nextDue <= t && r.estimate < 0.7)
    .map(([id, r]) => {
      const last = [...m.evidence].reverse().find((e) => e.topicId === id && (e.messageId || e.threadItemRefs.length > 0));
      const messageId = last?.messageId ?? last?.threadItemRefs[0]?.split(":")[1]?.split("#")[0];
      const ep = last && m.episodes.find((e) => e.id === last.sessionId);
      return {
        topicId: id,
        label: m.topics[id]?.label ?? id,
        estimate: r.estimate,
        dueAt: r.nextDue!,
        daysSince: Math.max(0, Math.round((t - r.lastSeen) / DAY)),
        source: last && messageId ? { threadId: last.threadId, messageId, threadTitle: ep?.threadTitle ?? "" } : null,
      };
    })
    .sort((a, b) => a.estimate - b.estimate);
}

/** Contextual trigger (SPEC §10.3 1–2): direct recurrence first, then interleaving. */
export function contextualRefresher(
  m: LearnerMemory,
  topics: { id: string }[],
  relatedKnown: string[] = [],
): { topicId: TopicId; label: string; daysSince: number; interleave: boolean } | null {
  const t = now(m);
  const practised = (id: string) => (m.mastery[id]?.attempts ?? 0) > 0 && (m.mastery[id]?.estimate ?? 1) < 0.9;
  const pick = (id: string, interleave: boolean) => ({
    topicId: id,
    label: m.topics[id]?.label ?? id,
    daysSince: Math.max(0, Math.round((t - m.mastery[id].lastSeen) / DAY)),
    interleave,
  });
  const direct = topics.map((x) => normalizeTopicId(x.id)).find(practised);
  if (direct) return pick(direct, false);
  // After repeated dismissals, only direct recurrence nudges remain (SPEC §10.3 guardrail).
  if (m.preferences.dismissals >= 3) return null;
  const adjacent = relatedKnown.map(normalizeTopicId).filter(practised).sort((a, b) => m.mastery[a].estimate - m.mastery[b].estimate)[0];
  return adjacent ? pick(adjacent, true) : null;
}

export function advanceClock(m: LearnerMemory, days: number): LearnerMemory {
  return { ...m, timeOffsetMs: m.timeOffsetMs + days * DAY };
}

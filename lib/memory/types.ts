// Learner memory schema (SPEC §10). Stored in localStorage for the prototype;
// designed to move server-side unchanged.
import type { ProbeMode, SessionTrigger, Verdict } from "@/lib/learn/types";

export type TopicId = string;

export type MasteryRecord = {
  estimate: number; // 0..1
  attempts: number;
  lastSeen: number;
  nextDue: number | null; // spaced repetition
  intervalIdx: number;
};

export type Evidence = {
  id: string; // `${probeId}#${attempt}`
  topicId: TopicId;
  sessionId: string;
  threadId: string;
  threadItemRefs: string[]; // anchors (stable thread item ids)
  probe: string;
  mode: ProbeMode;
  answer: string;
  verdict: Verdict;
  hinted: boolean;
  misconceptionTag?: string;
  estimateAfter: number;
  ts: number;
};

export type Episode = {
  id: string; // = learning session id
  threadId: string;
  threadTitle: string;
  trigger: SessionTrigger;
  topicIds: TopicId[];
  startedAt: number;
  endedAt?: number;
  masteryBefore: Record<TopicId, number | null>;
  masteryAfter: Record<TopicId, number | null>;
  recap?: string;
};

export type Misconception = {
  topicId: TopicId;
  tag: string;
  description: string;
  firstSeen: number;
  lastSeen: number;
  resolved: boolean;
};

export type LearnerMemory = {
  version: 1;
  topics: Record<TopicId, { label: string; related: TopicId[] }>;
  mastery: Record<TopicId, MasteryRecord>;
  evidence: Evidence[];
  episodes: Episode[];
  misconceptions: Misconception[];
  preferences: { shown: Record<string, number>; engaged: Record<string, number>; dismissals: number };
  timeOffsetMs: number; // simulated clock (SPEC §10.2)
};

export const emptyMemory = (): LearnerMemory => ({
  version: 1,
  topics: {},
  mastery: {},
  evidence: [],
  episodes: [],
  misconceptions: [],
  preferences: { shown: {}, engaged: {}, dismissals: 0 },
  timeOffsetMs: 0,
});

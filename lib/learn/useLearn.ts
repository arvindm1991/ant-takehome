"use client";
// Client orchestration for the learning sub-agent. Reads the main thread (read-only);
// never writes to it (SPEC §7.1).
import { useCallback, useEffect, useRef, useState } from "react";
import { ACME_NOTES } from "@/lib/repo/acmeNotes";
import { applyEvidence, bump, ensureTopics, estimateOf, learnerStateFor, normalizeTopicId, scheduleReview, snapshot, upsertEpisode } from "@/lib/memory/model";
import { getMemory, updateMemory } from "@/lib/memory/store";
import type { Thread } from "@/lib/thread/types";
import { crossCheckApproach, readsComplete } from "./mcq";
import { selectStrategy } from "./prompt";
import type {
  FeedEntry,
  GradeResult,
  Verdict,
  LearnAction,
  LearnEvent,
  LearnRequest,
  LearnSession,
  Learnability,
  Objective,
  SessionTrigger,
  TrajectoryItem,
} from "./types";

type Probe = Extract<LearnAction, { kind: "probe" }>;

const key = (threadId: string, messageId: string) => `${threadId}:${messageId}`;

const ORIENTATION = { id: "codebase-orientation", label: "Orienting in a codebase" };

function topicLabel(s: LearnSession, topicId: string) {
  const id = normalizeTopicId(topicId);
  if (id === ORIENTATION.id) return ORIENTATION.label;
  if (s.objective && normalizeTopicId(s.objective.topicId) === id) return s.objective.label;
  return s.topics.find((t) => normalizeTopicId(t.id) === id)?.label ?? topicId;
}

function sessionTopicIds(s: LearnSession) {
  return [...new Set([...s.topics.map((t) => t.id), ...(s.objective ? [s.objective.topicId] : []), ORIENTATION.id].map(normalizeTopicId))];
}

/** Write one graded attempt to learner memory, reschedule review and refresh the episode. */
function recordEvidence(s: LearnSession, thread: Thread, probe: Probe, answer: string, verdict: Verdict, misconceptionTag: string, anchors: string[]) {
  const probeAt = s.feed.find((e) => e.kind === "action" && e.action === probe)?.at ?? 0;
  const attempt = s.feed.filter((e) => e.kind === "answer" && e.probeId === probe.id).length;
  const hinted = s.feed.some((e) => e.kind === "action" && e.action.kind === "hint" && e.at > probeAt);
  const topicId = normalizeTopicId(probe.topicId);
  updateMemory((m) => {
    let next = applyEvidence(m, {
      id: `${probe.id}#${Math.max(1, attempt)}`,
      topicId,
      topicLabel: topicLabel(s, topicId),
      sessionId: s.id,
      threadId: thread.id,
      threadItemRefs: [...new Set([...probe.anchors, ...anchors])],
      probe: probe.question,
      mode: probe.mode,
      answer,
      verdict,
      hinted,
      misconceptionTag: misconceptionTag || undefined,
    });
    if (next === m) return m;
    next = scheduleReview(next, [topicId]);
    const ep = next.episodes.find((e) => e.id === s.id);
    if (ep) {
      const topicIds = [...new Set([...ep.topicIds, topicId])];
      next = upsertEpisode(next, { ...ep, topicIds, masteryAfter: { ...ep.masteryAfter, ...snapshot(next, [topicId]) }, masteryBefore: { [topicId]: estimateOf(m, topicId), ...ep.masteryBefore } });
    }
    return bump(next, "engaged", "probe");
  });
}

export function trajectoryFor(thread: Thread, messageId: string): TrajectoryItem[] {
  return thread.items
    .filter((i) => i.messageId === messageId)
    .map(({ id, kind, title, content, revealed }) => ({ id, kind, title, content, revealed }));
}

function turnDone(thread: Thread, messageId: string) {
  return thread.turns.find((t) => t.messageId === messageId)?.status === "done";
}

function findProbe(feed: FeedEntry[], probeId: string): Probe | null {
  for (const e of feed) if (e.kind === "action" && e.action.kind === "probe" && e.action.id === probeId) return e.action;
  return null;
}

/**
 * The feed as the learner (and the LSA) sees it: stored entries plus derived
 * cross-checks for "approach" MCQs, which resolve when the main agent finishes reading.
 */
export function deriveFeed(session: LearnSession, thread: Thread): FeedEntry[] {
  const traj = trajectoryFor(thread, session.messageId);
  const done = turnDone(thread, session.messageId);
  const resolvedAt =
    thread.items.find((i) => i.messageId === session.messageId && i.revealed && !["read", "reasoning"].includes(i.kind))?.revealedAt ??
    (done ? Date.now() : undefined);
  const out: FeedEntry[] = [...session.feed];
  for (const e of session.feed) {
    if (e.kind !== "answer") continue;
    const probe = findProbe(session.feed, e.probeId);
    if (!probe || probe.mode !== "approach") continue;
    if (readsComplete(traj, done) && resolvedAt) {
      out.push({ kind: "reveal", probeId: e.probeId, at: Math.max(resolvedAt, e.at + 1), ...crossCheckApproach(e.selected, probe.options, traj) });
    } else {
      out.push({ kind: "waiting", probeId: e.probeId, at: e.at + 1, text: "I'll check your picks against the files Claude actually opens." });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function useLearn(threads: Thread[], activeThreadId: string) {
  const [sessions, setSessions] = useState<Record<string, LearnSession>>({});
  const [learnability, setLearnability] = useState<Record<string, Learnability>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs mirror state so async handlers always read the latest values.
  const sessionsRef = useRef(sessions);
  const learnabilityRef = useRef(learnability);
  const threadsRef = useRef(threads);
  const learnOnRef = useRef(panelOpen);
  useEffect(() => {
    threadsRef.current = threads;
    learnOnRef.current = panelOpen;
  });

  // Approach MCQs resolve when the main agent finishes reading; record them to memory then.
  useEffect(() => {
    for (const s of Object.values(sessions)) {
      const thread = threads.find((t) => t.id === s.threadId);
      if (!thread) continue;
      for (const e of deriveFeed(s, thread)) {
        if (e.kind !== "reveal") continue;
        const probe = findProbe(s.feed, e.probeId);
        if (probe) recordEvidence(s, thread, probe, e.picked.join(", "), e.verdict, "", e.actual.map((a) => a.itemId));
      }
    }
  }, [sessions, threads]);

  const mutate = useCallback((threadId: string, fn: (s: LearnSession) => LearnSession) => {
    const cur = sessionsRef.current[threadId];
    if (!cur) return;
    sessionsRef.current = { ...sessionsRef.current, [threadId]: fn(cur) };
    setSessions(sessionsRef.current);
  }, []);

  const append = useCallback(
    (threadId: string, ...entries: FeedEntry[]) => mutate(threadId, (s) => ({ ...s, feed: [...s.feed, ...entries] })),
    [mutate],
  );

  const run = useCallback(
    async (threadId: string, event: LearnEvent) => {
      const s = sessionsRef.current[threadId];
      const thread = threadsRef.current.find((t) => t.id === threadId);
      if (!s || !thread) return;
      const feed = deriveFeed(s, thread);
      const mainAgentStatus = turnDone(thread, s.messageId) ? "done" : "working";
      const learner = learnerStateFor(getMemory(), sessionTopicIds(s));
      const objTopic = s.objective && learner.topics.find((t) => t.id === normalizeTopicId(s.objective!.topicId));
      const req: LearnRequest = {
        event,
        learner,
        userPrompt: thread.items.find((i) => i.messageId === s.messageId.replace("m", "u"))?.content ?? "",
        mainAgentStatus,
        trajectory: trajectoryFor(thread, s.messageId),
        repoTree: ACME_NOTES.map((f) => f.path),
        topics: s.topics,
        objective: s.objective,
        feed,
        strategy: selectStrategy(feed, mainAgentStatus, objTopic ? { estimate: objTopic.estimate, openMisconceptions: objTopic.openMisconceptions } : undefined),
      };
      mutate(threadId, (x) => ({ ...x, busy: true }));
      setError(null);
      try {
        const { actions } = await post<{ actions: LearnAction[] }>("/api/learn", req);
        const now = Date.now();
        append(threadId, ...actions.map((action, i): FeedEntry => ({ kind: "action", action, at: now + i })));
        updateMemory((m) => actions.reduce((acc, a) => (a.kind === "objectives" || a.kind === "end" ? acc : bump(acc, "shown", a.kind)), m));
        const end = actions.find((a) => a.kind === "end");
        if (end) {
          mutate(threadId, (x) => ({ ...x, ended: true }));
          updateMemory((m) => {
            const ep = m.episodes.find((e) => e.id === s.id);
            return ep ? upsertEpisode(m, { ...ep, endedAt: Date.now() + m.timeOffsetMs, recap: end.recap }) : m;
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        mutate(threadId, (x) => ({ ...x, busy: false }));
      }
    },
    [append, mutate],
  );

  const start = useCallback(
    (threadId: string, messageId: string, trigger: SessionTrigger) => {
      const existing = sessionsRef.current[threadId];
      setPanelOpen(true);
      if (existing && existing.messageId === messageId) return;
      const lb = learnabilityRef.current[key(threadId, messageId)];
      const id = `ls_${Date.now().toString(36)}`;
      const thread = threadsRef.current.find((t) => t.id === threadId);
      const topics = (lb?.topics ?? []).map((t) => ({ ...t, id: normalizeTopicId(t.id) }));
      updateMemory((m) => {
        const next = ensureTopics(m, topics);
        return upsertEpisode(next, {
          id,
          threadId,
          threadTitle: thread?.title ?? "",
          trigger,
          topicIds: topics.map((t) => t.id),
          startedAt: Date.now() + next.timeOffsetMs,
          masteryBefore: snapshot(next, topics.map((t) => t.id)),
          masteryAfter: snapshot(next, topics.map((t) => t.id)),
        });
      });
      sessionsRef.current = {
        ...sessionsRef.current,
        [threadId]: {
          id,
          threadId,
          messageId,
          trigger,
          topics,
          objective: null,
          feed: [],
          busy: false,
          ended: false,
          startedAt: Date.now(),
        },
      };
      setSessions(sessionsRef.current);
      void run(threadId, { type: "session_start" });
    },
    [run],
  );

  /** Called when a prompt is sent to the main agent. Learn mode on ⇒ auto-start if learnable. */
  const onPromptSent = useCallback(
    async (threadId: string, messageId: string, prompt: string) => {
      try {
        const known = learnerStateFor(getMemory(), []).knownTopics.map(({ id, label }) => ({ id, label }));
        const lb = await post<Learnability>("/api/learn/classify", { prompt, known });
        learnabilityRef.current = { ...learnabilityRef.current, [key(threadId, messageId)]: lb };
        setLearnability(learnabilityRef.current);
        if (lb.learnable && learnOnRef.current) start(threadId, messageId, "live");
      } catch {
        /* learnability is best-effort */
      }
    },
    [start],
  );

  const selectObjective = useCallback(
    (threadId: string, objective: Objective) => {
      mutate(threadId, (s) => ({ ...s, objective }));
      void run(threadId, { type: "objective_selected" });
    },
    [mutate, run],
  );

  const answer = useCallback(
    async (threadId: string, probeId: string, text: string, selected: string[]) => {
      const s = sessionsRef.current[threadId];
      const thread = threadsRef.current.find((t) => t.id === threadId);
      const probe = s && findProbe(s.feed, probeId);
      if (!s || !thread || !probe) return;
      append(threadId, { kind: "answer", probeId, text, selected, at: Date.now() });

      if (probe.mode === "approach" && probe.format === "mcq") {
        const traj = trajectoryFor(thread, s.messageId);
        if (readsComplete(traj, turnDone(thread, s.messageId))) {
          const { verdict } = crossCheckApproach(selected, probe.options, traj);
          void run(threadId, { type: "answer_graded", probeId, verdict });
        } else {
          // Pre-emption continues while we wait for the main agent's reads.
          void run(threadId, { type: "answer_submitted", probeId });
        }
        return;
      }

      mutate(threadId, (x) => ({ ...x, busy: true }));
      try {
        const g = await post<GradeResult>("/api/learn/grade", {
          probe,
          answer: selected.length ? selected.join(", ") : text,
          trajectory: trajectoryFor(thread, s.messageId),
        });
        append(threadId, {
          kind: "feedback",
          probeId,
          verdict: g.verdict,
          text: g.feedback,
          anchors: g.revealAnchors,
          misconceptionTag: g.misconceptionTag,
          at: Date.now(),
        });
        mutate(threadId, (x) => ({ ...x, busy: false }));
        recordEvidence(sessionsRef.current[threadId] ?? s, thread, probe, text, g.verdict, g.misconceptionTag, g.revealAnchors);
        void run(threadId, { type: "answer_graded", probeId, verdict: g.verdict });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        mutate(threadId, (x) => ({ ...x, busy: false }));
      }
    },
    [append, mutate, run],
  );

  const ask = useCallback(
    (threadId: string, text: string) => {
      append(threadId, { kind: "user", text, at: Date.now() });
      void run(threadId, { type: "user_message", text });
    },
    [append, run],
  );

  return {
    session: sessions[activeThreadId] ?? null,
    sessions,
    learnability: (threadId: string, messageId: string) => learnability[key(threadId, messageId)],
    panelOpen,
    setPanelOpen,
    error,
    start,
    onPromptSent,
    selectObjective,
    answer,
    ask,
  };
}

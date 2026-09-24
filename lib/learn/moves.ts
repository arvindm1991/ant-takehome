// Pure session logic for the mentor panel: next moves, arc, breadcrumb, proactive
// nudges. Everything here derives from the session feed + the (read-only) thread.
import type { ThreadItem } from "@/lib/thread/types";
import type { FeedEntry, LearnAction, LearnSession, MoveKind, Verdict } from "./types";

type Probe = Extract<LearnAction, { kind: "probe" }>;

export type NextMove = { move: MoveKind; label: string; target: string; hint: string };

const actions = (feed: FeedEntry[]) => feed.filter((e): e is Extract<FeedEntry, { kind: "action" }> => e.kind === "action");

export function answeredProbeIds(feed: FeedEntry[]): Set<string> {
  return new Set(feed.filter((e) => e.kind === "answer").map((e) => (e as { probeId: string }).probeId));
}

/** The question currently waiting for an answer: never answered, or reopened by a hint after its last answer. */
export function openProbe(feed: FeedEntry[]): Probe | null {
  const pIdx = feed.map((e) => e.kind === "action" && e.action.kind === "probe").lastIndexOf(true);
  if (pIdx < 0) return null;
  const probe = (feed[pIdx] as Extract<FeedEntry, { kind: "action" }>).action as Probe;
  const lastAnswer = feed.map((e) => e.kind === "answer" && e.probeId === probe.id).lastIndexOf(true);
  if (lastAnswer < 0) return probe;
  const hintAfter = feed.some((e, i) => i > lastAnswer && e.kind === "action" && e.action.kind === "hint");
  return hintAfter ? probe : null;
}

/** "Move 2 of 3": questions answered in this session vs the session's target. */
export function arcOf(session: LearnSession, feed: FeedEntry[]) {
  const done = answeredProbeIds(feed).size;
  return { done, target: session.moveTarget, complete: done >= session.moveTarget };
}

/** JWT verification → Signatures → HMAC: the concepts this session has walked through. */
export function breadcrumb(feed: FeedEntry[]): string[] {
  const out: string[] = [];
  for (const a of actions(feed)) {
    const c = "concept" in a.action ? a.action.concept?.trim() : "";
    if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c);
  }
  return out.slice(-5);
}

/** Latest deeper/sibling targets offered by the mentor. */
export function latestTrail(feed: FeedEntry[]): { deeper: string; sibling: string } {
  for (const a of actions(feed).reverse()) {
    const x = a.action as { deeper?: string; sibling?: string };
    if (x.deeper || x.sibling) return { deeper: x.deeper ?? "", sibling: x.sibling ?? "" };
  }
  return { deeper: "", sibling: "" };
}

const m = (move: MoveKind, label: string, target: string, hint: string): NextMove => ({ move, label, target, hint });

/**
 * 2–3 next moves after every mentor turn, so the learner never faces an empty box.
 * Got it right → dig deeper / hands-on / zoom out. Missed or stuck → hint / show me in
 * Claude's code / easier question.
 */
export function nextMoves(session: LearnSession, feed: FeedEntry[]): NextMove[] {
  if (!session.objective || session.ended || session.busy) return [];
  const trail = latestTrail(feed);
  const deeper = m("dig_deeper", "Dig deeper", trail.deeper, "One level further into the mechanism");
  const zoom = m("zoom_out", "Zoom out", trail.sibling, "A sibling concept");
  const usedWidget = actions(feed).some((a) => a.action.kind === "demonstrate");
  const handsOn = usedWidget ? m("challenge", "Challenge me", "", "A harder what-if") : m("hands_on", "Try it hands-on", "", "Interactive demo of this idea");

  const open = openProbe(feed);
  if (open) {
    const pIdx = feed.findIndex((e) => e.kind === "action" && e.action === open);
    const hinted = feed.some((e, i) => i > pIdx && e.kind === "action" && e.action.kind === "hint");
    return [hinted ? null : m("hint", "Hint", "", "A nudge, not the answer"), m("easier", "Easier question", "", "Same idea, simpler"), m("show_code", "Show me in Claude's code", "", "Where the answer lives")].filter(Boolean) as NextMove[];
  }

  const last = [...feed].reverse().find((e) => e.kind === "action" || e.kind === "feedback" || e.kind === "reveal");
  if (!last) return [];
  if (last.kind === "feedback" || last.kind === "reveal") {
    return (last.verdict as Verdict) === "correct" ? [deeper, handsOn, zoom] : [m("hint", "Hint", "", "Try again with a nudge"), m("show_code", "Show me in Claude's code", "", "Where the answer lives"), m("easier", "Easier question", "", "Same idea, simpler")];
  }
  if (last.kind === "action" && (last.action.kind === "explain" || last.action.kind === "demonstrate" || last.action.kind === "hint")) {
    return [m("quiz", "Quiz me on this", "", "Check it stuck"), deeper, zoom];
  }
  return [];
}

const mentions = (text: string, title: string) => title.length > 3 && text.includes(title);

export type Nudge = { key: string; itemId: string; itemTitle: string; probeId: string | null; text: string; cta: string };

/**
 * Proactive check-in when the main agent reveals a step the session cares about:
 * first a step that answers one of the learner's predictions, else the newest file
 * Claude wrote since the goal was chosen. Stays until the learner acts or dismisses.
 */
export function pendingNudge(session: LearnSession, items: ThreadItem[]): Nudge | null {
  if (!session.objective || session.ended || session.busy || session.objectiveAt == null) return null;
  const acted = new Set(session.actedNudges);
  const turn = items.filter((i) => i.messageId === session.messageId);
  const byId = new Map(turn.map((i) => [i.id, i]));

  for (const e of session.feed) {
    if (e.kind !== "answer") continue;
    const probe = actions(session.feed).find((a) => a.action.kind === "probe" && a.action.id === e.probeId)?.action as Probe | undefined;
    if (!probe || probe.mode !== "predict" || acted.has(`pred:${probe.id}`)) continue;
    // Predictions are often asked before the step exists, so also watch for any file the question names.
    const targets = [...probe.anchors.map((id) => byId.get(id)), ...turn.filter((i) => i.kind === "file" && mentions(probe.question, i.title))];
    const item = targets.find((i) => i?.revealed && (i.revealedAt ?? 0) > e.at);
    if (item) return { key: `pred:${probe.id}`, itemId: item.id, itemTitle: item.title, probeId: probe.id, text: `Claude just wrote ${item.title}. Want to check it against your prediction?`, cta: "Check my prediction" };
  }

  const referenced = new Set(actions(session.feed).flatMap((a) => ("anchors" in a.action ? a.action.anchors : [])));
  const named = (i: ThreadItem) => actions(session.feed).some((a) => a.action.kind === "probe" && mentions(a.action.question, i.title));
  const fresh = turn.filter((i) => i.kind === "file" && i.revealed && (i.revealedAt ?? 0) > session.objectiveAt! && !referenced.has(i.id) && !named(i) && !acted.has(`step:${i.id}`));
  const latest = fresh.at(-1);
  if (!latest) return null;
  return { key: `step:${latest.id}`, itemId: latest.id, itemTitle: latest.title, probeId: null, text: `Claude just wrote ${latest.title}. Want a quick question on it?`, cta: "Quiz me on it" };
}

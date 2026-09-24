"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowDownRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Clock,
  Code2,
  Compass,
  Flame,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Loader2,
  MousePointerClick,
  Mountain,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  X,
  ZoomOut,
} from "lucide-react";
import { deriveFeed } from "@/lib/learn/useLearn";
import { breadcrumb, latestTrail, nextMoves, openProbe, pendingNudge, type NextMove, type Nudge } from "@/lib/learn/moves";
import { estimateOf, normalizeTopicId, PRIOR, type Refresher } from "@/lib/memory/model";
import { useMemory } from "@/lib/memory/store";
import type { FeedEntry, LearnAction, LearnSession, MoveKind, Objective, ProbeMode, Verdict } from "@/lib/learn/types";
import type { Thread } from "@/lib/thread/types";
import { focusThreadItem } from "@/lib/thread/focus";
import { useFollowScroll } from "@/lib/useFollowScroll";
import { JumpToLatest } from "../JumpToLatest";
import { ProgressView } from "./ProgressView";
import { Widget } from "./Widget";
import { InboxView } from "./InboxView";

export type PanelTab = "session" | "progress" | "inbox";
/** What the learning sub-agent is called in the UI: the same name as the switch that turns it on. */
export const LSA_NAME = "Learn mode";
const TAB_LABEL: Record<PanelTab, string> = { session: "Session", progress: "Your progress", inbox: "Inbox" };

type Props = {
  thread: Thread;
  session: LearnSession | null;
  simulated: boolean;
  canStart: { messageId: string; trigger: "live" | "post_task" } | null;
  error: string | null;
  onClose: () => void;
  onObjective: (o: Objective) => void;
  onAnswer: (probeId: string, text: string, selected: string[]) => void;
  onAsk: (text: string) => void;
  onMove: (move: MoveKind, target: string, label: string) => void;
  onNudge: (nudge: Nudge, accept: boolean) => void;
  onKeepGoing: (target: string) => void;
  onPickAnotherGoal: () => void;
  onWidgetEngaged: () => void;
  onWidgetRetry: (action: Extract<LearnAction, { kind: "demonstrate" }>) => void;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onOpenRefresher: (r: Refresher) => void;
  threadExists: (id: string) => boolean;
  dueCount: number;
  /** "sheet": the phone layout, a bottom sheet that can shrink to a peek bar (see LearnPeek). */
  variant?: "side" | "sheet";
  /** Collapse without turning Learn mode off: the sheet shrinks to its peek bar, the side panel to a rail. */
  onMinimize?: () => void;
};

/**
 * Learn mode's panel: the learning sub-agent beside Claude, deliberately styled apart from it.
 * It teaches by showing (interactives first), asks, and checks; it never does the task.
 */
export function LearnPanel(props: Props) {
  const { thread, session, simulated, error, onClose, tab, onTab, dueCount, variant = "side", onMinimize } = props;
  const sheet = variant === "sheet";
  const feed = session ? deriveFeed(session, thread) : [];
  const nudge = session ? pendingNudge(session, thread.items) : null;
  const { ref: scrollRef, el: scrollEl, following, paused, resume, scrollTo, scrollToBottom } = useFollowScroll();
  // Anything the learner does (answer, ask, pick a goal or a next step) means "show me what comes next".
  const acted = `${session?.id}:${session?.objective?.label ?? ""}:${feed.filter((e) => e.kind === "answer" || e.kind === "user" || e.kind === "move").length}`;
  const seenActed = useRef(acted);
  useEffect(() => {
    if (acted !== seenActed.current) {
      seenActed.current = acted;
      resume();
    }
    // Only follow while the reader is at the bottom; scrolling up to read or review pauses it.
    if (!scrollEl || !following()) return;
    // Keep the start of the latest turn in view (goal list, feedback, a demo and its question, a check-in), then as much below as fits.
    const turns = scrollEl.querySelectorAll<HTMLElement>("[data-lsa-turn]");
    const last = turns[turns.length - 1];
    const bottom = scrollEl.scrollHeight - scrollEl.clientHeight;
    scrollTo(last ? Math.min(bottom, last.offsetTop - 12) : bottom);
  }, [feed.length, session?.busy, nudge?.key, acted, scrollEl, following, resume, scrollTo]);

  return (
    <aside aria-label={LSA_NAME} className={`flex h-full shrink-0 flex-col bg-lsa ${sheet ? "w-full rounded-t-2xl border-t border-lsa-border" : "w-full border-l border-lsa-border"}`}>
      {sheet && (
        <button onClick={onMinimize} aria-label="Minimize learn mode" className="flex w-full justify-center pt-2 pb-0.5">
          <span className="h-1 w-10 rounded-full bg-lsa-border" />
        </button>
      )}
      <header className={`flex items-center gap-3 px-4 ${sheet ? "pt-0.5 pb-1" : "border-b border-lsa-border pt-3.5 pb-3"}`}>
        <span className={`flex items-center justify-center rounded-full bg-learn/15 text-learn ring-1 ring-learn/40 ${sheet ? "h-7 w-7" : "h-9 w-9"}`}>
          <GraduationCap size={sheet ? 15 : 18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14.5px] font-semibold text-learn">
            {LSA_NAME}
            {simulated && <span className="rounded-full bg-note-soft px-1.5 py-0.5 text-[10.5px] font-normal text-note">scripted mock</span>}
          </div>
          {!sheet && <div className="truncate text-[12px] text-muted">Learn from what Claude is building. Claude does the work.</div>}
        </div>
        {sheet ? (
          <button onClick={onMinimize} aria-label="Show Claude's work" className="rounded-md p-1.5 text-muted hover:bg-lsa-surface hover:text-text">
            <ChevronDown size={18} />
          </button>
        ) : (
          onMinimize && (
            <button onClick={onMinimize} aria-label="Collapse learn mode" title="Collapse (Learn mode stays on)" className="rounded-md p-1 text-muted hover:bg-lsa-surface hover:text-text">
              <PanelRightClose size={16} />
            </button>
          )
        )}
        <button onClick={onClose} aria-label="Turn off learn mode" title="Turn off learn mode" className={`rounded-md text-muted hover:bg-lsa-surface hover:text-text ${sheet ? "p-1.5" : "p-1"}`}>
          <X size={sheet ? 18 : 16} />
        </button>
      </header>
      <div className="flex gap-4 border-b border-lsa-border px-4 text-[13px]">
        {(["session", "progress", "inbox"] as const).map((t) => (
          <button key={t} onClick={() => onTab(t)} className={`flex items-center gap-1.5 border-b-2 py-2 ${tab === t ? "border-learn font-medium text-text" : "border-transparent text-muted hover:text-text"}`}>
            {TAB_LABEL[t]}
            {t === "inbox" && dueCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-white">{dueCount}</span>}
          </button>
        ))}
      </div>

      {tab === "progress" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ProgressView activeThreadId={thread.id} />
        </div>
      ) : tab === "inbox" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <InboxView onOpen={props.onOpenRefresher} threadExists={props.threadExists} />
        </div>
      ) : (
        <>
          {session?.objective && <SessionHeader session={session} feed={feed} compact={sheet} />}
          <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
            {!session && <NoSession canStart={props.canStart} />}
            {session &&
              feed.map((e, i) => (
                <div key={i} data-lsa-turn={isLsa(e) && !(i > 0 && isLsa(feed[i - 1])) ? "" : undefined}>
                  <Entry {...props} entry={e} feed={feed} session={session} />
                </div>
              ))}
            {session?.busy && <Thinking objectivesPending={!feed.some((e) => e.kind === "action" && e.action.kind === "objectives")} />}
            {nudge && (
              <div data-lsa-turn="">
                <NudgeCard nudge={nudge} onNudge={props.onNudge} />
              </div>
            )}
            {error && <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</div>}
            {paused && (
              <JumpToLatest
                tone="learn"
                onClick={() => {
                  resume();
                  scrollToBottom();
                }}
              />
            )}
          </div>
          {session && <LsaComposer session={session} feed={feed} onAnswer={props.onAnswer} onAsk={props.onAsk} onMove={props.onMove} compact={sheet} />}
        </>
      )}
    </aside>
  );
}

const isLsa = (e: FeedEntry) => e.kind === "action" || e.kind === "feedback";

/* ------------------------------------------------------------------ phone peek bar */

/**
 * Learn mode minimized on a phone: one line above the composer, so Claude's work stays in view.
 * It never expands by itself; a new question or check-in only changes the line and adds a dot.
 */
/** One line on what Learn mode is doing, and whether something is waiting for the learner. */
function peekState(thread: Thread, session: LearnSession | null) {
  const feed = session ? deriveFeed(session, thread) : [];
  const nudge = session ? pendingNudge(session, thread.items) : null;
  const open = session && !session.busy ? openProbe(feed) : null;
  const hasGoals = feed.some((e) => e.kind === "action" && e.action.kind === "objectives");
  const [line, waiting]: [string, boolean] = !session
    ? ["On. Give Claude a task and I’ll start teaching from it", false]
    : session.busy
      ? ["Thinking…", false]
      : open
        ? [`Your turn: ${open.question.replace(/`/g, "")}`, true]
        : nudge
          ? [nudge.text, true]
          : session.ended
            ? ["Your recap is ready", true]
            : !session.objective && hasGoals
              ? ["Pick something to learn from this task", true]
              : [session.objective?.label ?? LSA_NAME, false];
  return { line, waiting, nudge, open };
}

/** Learn mode collapsed on a wide screen: a slim rail that still shows when something is waiting. */
export function LearnRail({ thread, session, onExpand }: { thread: Thread; session: LearnSession | null; onExpand: () => void }) {
  const { line, waiting } = peekState(thread, session);
  return (
    <aside aria-label={`${LSA_NAME} (collapsed)`} className="flex h-full w-12 shrink-0 flex-col items-center gap-3 border-l border-lsa-border bg-lsa pt-3.5">
      <button onClick={onExpand} aria-label="Expand learn mode" title={line} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-learn/15 text-learn ring-1 ring-learn/40 hover:bg-learn/25">
        <GraduationCap size={17} />
        {waiting && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-learn ring-2 ring-lsa" />}
      </button>
      <button onClick={onExpand} aria-hidden tabIndex={-1} className="rounded-md p-1 text-muted hover:text-text">
        <PanelRightOpen size={16} />
      </button>
      <span className="mt-1 text-[11px] font-medium tracking-wide text-learn/80 [writing-mode:vertical-rl]">{LSA_NAME}</span>
    </aside>
  );
}

export function LearnPeek({ thread, session, onExpand, onNudge }: { thread: Thread; session: LearnSession | null; onExpand: () => void; onNudge: Props["onNudge"] }) {
  const { line, waiting, nudge, open } = peekState(thread, session);
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-lsa-border bg-lsa py-1.5 pr-1.5 pl-2 shadow-lg">
      <button onClick={onExpand} aria-label="Open learn mode" className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-learn/15 text-learn ring-1 ring-learn/40">
          <GraduationCap size={16} />
          {waiting && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-learn ring-2 ring-lsa" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-learn">{LSA_NAME}</span>
          <span className={`block truncate text-[13px] ${session?.busy ? "shimmer" : "text-text/90"}`}>{line}</span>
        </span>
      </button>
      {nudge && !open ? (
        <button
          onClick={() => {
            onExpand();
            onNudge(nudge, true);
          }}
          className="shrink-0 rounded-full bg-learn px-3 py-1.5 text-[12.5px] font-medium text-lsa"
        >
          {nudge.cta}
        </button>
      ) : (
        <button onClick={onExpand} aria-label="Expand learn mode" className="shrink-0 rounded-full p-2 text-muted">
          <ChevronUp size={18} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function SessionHeader({ session, feed, compact }: { session: LearnSession; feed: FeedEntry[]; compact?: boolean }) {
  const allCrumbs = breadcrumb(feed);
  // Phone: one line. The goal is on its card in the feed; the header keeps only where you are.
  // No move counter: the session still wraps up after its questions, but a visible count read as homework.
  const crumbs = compact ? [] : allCrumbs;
  return (
    <div className={`border-y border-lsa-border bg-lsa-surface/50 px-4 ${compact ? "py-1.5" : "border-t-0 py-2.5"}`}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className={`truncate font-medium ${compact ? "text-learn" : "text-text/90"}`}>{compact ? (allCrumbs.at(-1) ?? session.objective?.label) : session.objective?.label}</span>
        {session.ended && <span className="ml-auto shrink-0 text-muted">Done</span>}
      </div>
      {crumbs.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11.5px] text-learn/90" aria-label="What we've covered">
          {crumbs.map((c, i) => (
            <span key={c} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={11} className="text-muted" />}
              <span className={i === crumbs.length - 1 ? "font-medium text-learn" : ""}>{c}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ empty */

function NoSession({ canStart }: Pick<Props, "canStart">) {
  // Learn mode on ⇒ the learning agent is on: the app starts a session as soon as there's a learnable task.
  if (canStart) return <GoalSkeleton />;
  return (
    <div className="rounded-xl border border-lsa-border bg-lsa-surface p-4 text-[14px] leading-relaxed">
      <p className="font-serif text-[16px]">Learn mode is on.</p>
      <p className="mt-2 text-muted">Give Claude a task. While it works, I’ll pull out what’s worth learning, show you how it works with interactive demos built from Claude’s actual code, and check your thinking as the code lands.</p>
      <p className="mt-2 text-muted">I never do the task for you, and the task never waits on me.</p>
    </div>
  );
}

function GoalSkeleton() {
  return (
    <div className="space-y-2" aria-label="Finding learning goals">
      <p className="px-1 text-[13px] text-muted">
        <Loader2 size={13} className="mr-1.5 inline animate-spin" />
        Reading what Claude is doing to suggest goals…
      </p>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[74px] animate-pulse rounded-xl border border-lsa-border bg-lsa-surface/60" />
      ))}
    </div>
  );
}

function Thinking({ objectivesPending }: { objectivesPending: boolean }) {
  if (objectivesPending) return <GoalSkeleton />;
  return (
    <div className="flex items-center gap-2 px-1 text-[13px] text-muted">
      <Loader2 size={14} className="animate-spin" /> <span className="shimmer">Thinking…</span>
    </div>
  );
}

/* ------------------------------------------------------------------ feed */

const MODE: Record<ProbeMode, { label: string; icon: typeof Compass }> = {
  approach: { label: "Approach", icon: Compass },
  predict: { label: "Predict", icon: Sparkles },
  explain_back: { label: "Explain back", icon: BookOpen },
  what_if: { label: "What if", icon: FlaskConical },
};

type EntryProps = Props & { entry: FeedEntry; feed: FeedEntry[]; session: LearnSession };

function Entry(p: EntryProps) {
  const { entry } = p;
  switch (entry.kind) {
    case "action":
      return <ActionCard {...p} action={entry.action} />;
    case "answer":
      return (
        <LearnerBlock label="Your answer">
          {entry.selected.length ? entry.selected.map((s) => <code key={s} className="mr-1.5 font-mono text-[12.5px]">{s}</code>) : entry.text}
        </LearnerBlock>
      );
    case "user":
      return <LearnerBlock label="You asked">{entry.text}</LearnerBlock>;
    case "move":
      return (
        <div className="flex items-center gap-1.5 pl-1 text-[12px] text-muted">
          <ArrowDownRight size={12} className="text-learn" /> You chose <span className="text-text/85">{entry.label}</span>
        </div>
      );
    case "waiting":
      return (
        <div className="flex items-center gap-2 px-1 text-[12.5px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-learn" /> {entry.text}
        </div>
      );
    case "reveal": {
      const extras = entry.picked.filter((x) => !entry.actual.some((a) => a.path === x));
      return (
        <LsaCard tone={entry.verdict} kicker={<><Compass size={13} /> Cross-check <VerdictBadge v={entry.verdict} /></>}>
          <p className="mb-2">Here’s where Claude actually looked first, and why:</p>
          <ul className="space-y-1.5 font-sans">
            {entry.actual.map((a) => (
              <li key={a.path} className="text-[13px]">
                <button onClick={() => focusThreadItem(a.itemId)} className="font-mono text-[12.5px] text-learn hover:underline">
                  {entry.picked.includes(a.path) ? "✓ " : "○ "}
                  {a.path} ↗
                </button>
                <div className="pl-4 text-muted">{a.why}</div>
              </li>
            ))}
          </ul>
          {extras.length > 0 && (
            <p className="mt-2 font-sans text-[13px] text-muted">
              You also picked {extras.map((x) => <code key={x} className="mr-1 font-mono text-[12px]">{x}</code>)}. Claude skipped {extras.length > 1 ? "those" : "that"}. What would it have told you about adding login?
            </p>
          )}
        </LsaCard>
      );
    }
    case "feedback":
      return (
        <LsaCard tone={entry.verdict} kicker={<VerdictBadge v={entry.verdict} />}>
          <Md>{entry.text}</Md>
          <Anchors ids={entry.anchors} thread={p.thread} label="See it in Claude’s work" />
        </LsaCard>
      );
  }
}

function ActionCard(p: EntryProps & { action: LearnAction }) {
  const { action, session, thread, feed } = p;
  switch (action.kind) {
    case "objectives":
      return <GoalCards objectives={action.objectives} session={session} onPick={p.onObjective} />;
    case "probe": {
      const M = MODE[action.mode];
      const open = openProbe(feed)?.id === action.id;
      return (
        <LsaCard kicker={<><M.icon size={13} /> {M.label}</>} highlight={open}>
          <Md>{action.question}</Md>
          <Anchors ids={action.anchors} thread={thread} label="About" />
          {open && action.format === "mcq" && <McqInput probeId={action.id} options={action.options} disabled={session.busy} onAnswer={p.onAnswer} />}
          {open && action.format !== "mcq" && <p className="mt-2 font-sans text-[12px] text-learn/80">↓ Answer in the box below</p>}
        </LsaCard>
      );
    }
    case "hint":
      return (
        <LsaCard kicker={<><Lightbulb size={13} /> Hint</>} accent="note">
          <Md>{action.text}</Md>
          <Anchors ids={action.anchors} thread={thread} />
        </LsaCard>
      );
    case "explain":
      return (
        <LsaCard kicker={<><HelpCircle size={13} /> Explanation</>}>
          <Md>{action.text}</Md>
          <Anchors ids={action.anchors} thread={thread} label="In Claude’s code" />
        </LsaCard>
      );
    case "demonstrate":
      return (
        <LsaCard kicker={<><MousePointerClick size={13} /> Try it · {action.title}</>}>
          <div className="font-sans">
            <Widget state={session.widgets[action.id]} title={action.title} onEngaged={p.onWidgetEngaged} onRetry={() => p.onWidgetRetry(action)} />
          </div>
          <Anchors ids={action.anchors} thread={thread} label="Mirrors" />
        </LsaCard>
      );
    case "end":
      return <Recap session={session} feed={feed} recap={action.recap} onKeepGoing={p.onKeepGoing} onPickAnotherGoal={p.onPickAnotherGoal} />;
  }
}

/* ------------------------------------------------------------------ goals */

const KIND: Record<string, { label: string; icon: typeof Compass }> = {
  orient: { label: "Orient", icon: Compass },
  core: { label: "Core", icon: BookOpen },
  stretch: { label: "Stretch", icon: Mountain },
};

function GoalCards({ objectives, session, onPick }: { objectives: Objective[]; session: LearnSession; onPick: (o: Objective) => void }) {
  const memory = useMemory();
  const [showSolid, setShowSolid] = useState(false);
  const est = (o: Objective) => estimateOf(memory, normalizeTopicId(o.topicId));
  const solid = objectives.filter((o) => (est(o) ?? 0) >= 0.7);
  const open = objectives.filter((o) => !solid.includes(o));
  const chosen = session.objective;

  if (chosen) {
    const o = objectives.find((x) => x.topicId === chosen.topicId && x.label === chosen.label) ?? chosen;
    return (
      <div className="rounded-xl border border-learn/50 bg-learn/10 px-3.5 py-2.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-learn">Your goal</div>
        <div className="mt-0.5 text-[14px] font-medium">{o.label}</div>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 px-1 font-serif text-[15.5px] leading-snug">Claude is doing the work. Here’s what’s worth learning from it:</p>
      <ol className="space-y-2">
        {open.map((o, i) => {
          const K = KIND[o.kind ?? "core"] ?? KIND.core;
          return (
            <li key={`${o.topicId}-${i}`}>
              <button onClick={() => onPick(o)} className="group w-full rounded-xl border border-lsa-border bg-lsa-surface px-3.5 py-3 text-left transition hover:border-learn/60 hover:bg-learn/10">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-learn/90">
                  <K.icon size={12} /> {K.label}
                  {o.minutes ? (
                    <span className="ml-auto flex items-center gap-1 font-normal normal-case tracking-normal text-muted">
                      <Clock size={11} /> ~{o.minutes} min
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[14.5px] font-medium leading-snug text-text">{o.label}</div>
                {o.teaser && <div className="mt-1 font-serif text-[14px] italic text-learn">“{o.teaser}”</div>}
                <div className="mt-1 text-[12.5px] text-muted">{o.why}</div>
              </button>
            </li>
          );
        })}
      </ol>
      {solid.length > 0 && (
        <div className="mt-2 rounded-lg border border-lsa-border px-3 py-2 text-[12.5px] text-muted">
          <button onClick={() => setShowSolid((v) => !v)} className="flex w-full items-center gap-1.5 text-left">
            <ChevronDown size={13} className={showSolid ? "" : "-rotate-90"} /> Already solid ({solid.length}): {solid.map((o) => o.topicLabel ?? o.topicId).join(", ")}
          </button>
          {showSolid && (
            <ul className="mt-2 space-y-1.5">
              {solid.map((o) => (
                <li key={o.topicId}>
                  <button onClick={() => onPick(o)} className="w-full rounded-md px-2 py-1 text-left hover:bg-lsa-surface">
                    {o.label} <span className="text-learn">· review anyway</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ moves */

const MOVE_ICON: Record<MoveKind, typeof Compass> = {
  dig_deeper: ArrowDownRight,
  zoom_out: ZoomOut,
  hands_on: MousePointerClick,
  hint: Lightbulb,
  show_code: Code2,
  easier: ChevronDown,
  quiz: HelpCircle,
  explain: BookOpen,
  show: MousePointerClick,
  challenge: Flame,
  keep_going: ArrowDownRight,
};

function MoveChips({ moves, onMove, compact }: { moves: NextMove[]; onMove: Props["onMove"]; compact?: boolean }) {
  if (moves.length === 0) return null;
  return (
    <div className={`mb-2 flex gap-1.5 ${compact ? "-mx-3 overflow-x-auto px-3 [scrollbar-width:none]" : "flex-wrap"}`} aria-label="Where next">
      {moves.map((mv) => {
        const Icon = MOVE_ICON[mv.move];
        return (
          <button
            key={mv.move}
            onClick={() => onMove(mv.move, mv.target, mv.target ? `${mv.label}: ${mv.target}` : mv.label)}
            title={mv.hint}
            className="flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-learn/40 bg-learn/5 px-3 py-1.5 text-left text-[12.5px] transition hover:border-learn/70 hover:bg-learn/15"
          >
            <Icon size={13} className="shrink-0 text-learn" />
            <span data-move-label className="shrink-0 font-medium text-learn">{mv.label}</span>
            {mv.target && <span className="truncate text-muted">{mv.target}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A proactive check-in, in the learning agent's own voice, when Claude reveals a step worth pausing on. */
function NudgeCard({ nudge, onNudge }: { nudge: Nudge; onNudge: Props["onNudge"] }) {
  return (
    <div className="appear rounded-xl border border-learn/50 bg-learn/10 px-3.5 py-2.5" role="status">
      <div className="flex items-start gap-2">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-learn" />
        <p className="font-serif text-[15px] leading-snug">{nudge.text}</p>
      </div>
      <div className="mt-2 flex gap-2 pl-6">
        <button onClick={() => onNudge(nudge, true)} className="rounded-lg bg-learn px-3 py-1 text-[12.5px] font-medium text-lsa">
          {nudge.cta}
        </button>
        <button onClick={() => onNudge(nudge, false)} className="rounded-lg px-2 py-1 text-[12.5px] text-muted hover:text-text">
          Later
        </button>
      </div>
    </div>
  );
}

const PLACEHOLDER: Record<ProbeMode, string> = {
  approach: "Your approach…",
  predict: "Your prediction, in your own words…",
  explain_back: "Explain it in your own words…",
  what_if: "What would happen?",
};

/**
 * Learn mode's own text box, styled apart from Claude's composer. It answers the open question when
 * there is one, otherwise it asks about Claude's work. Next moves sit right above it as chips.
 */
function LsaComposer({ session, feed, onAnswer, onAsk, onMove, compact }: { session: LearnSession; feed: FeedEntry[]; onAnswer: Props["onAnswer"]; onAsk: Props["onAsk"]; onMove: Props["onMove"]; compact?: boolean }) {
  const [text, setText] = useState("");
  // What the box was for when typing began, so a question arriving mid-sentence doesn't hijack the draft.
  const [lockedTo, setLockedTo] = useState<string | null>(null);
  const open = openProbe(feed);
  const question = open && open.format !== "mcq" ? open : null;
  const mode = text ? lockedTo : (question?.id ?? "ask");
  const answering = !!question && mode === question.id;
  const hasGoals = feed.some((e) => e.kind === "action" && e.action.kind === "objectives");
  const submit = () => {
    const t = text.trim();
    if (!t || session.busy) return;
    if (answering) onAnswer(question.id, t, []);
    else onAsk(t);
    setText("");
    setLockedTo(null);
  };
  return (
    <div className="border-t border-lsa-border bg-lsa px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <MoveChips moves={nextMoves(session, feed)} onMove={onMove} compact={compact} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`rounded-2xl border bg-lsa-surface px-3 pt-2 pb-2 transition ${answering ? "border-learn/70 ring-1 ring-learn/30" : "border-learn/30 focus-within:border-learn/60"}`}
      >
        {answering && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-learn">
            <ArrowDownRight size={12} /> Answering: {MODE[question.mode].label}
          </div>
        )}
        <div className="flex items-end gap-2">
          <GraduationCap size={16} className="mb-1.5 shrink-0 text-learn/80" />
          <textarea
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              if (!text && v) setLockedTo(question?.id ?? "ask");
              if (!v) setLockedTo(null);
              setText(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={answering ? 2 : 1}
            enterKeyHint="send"
            aria-label={answering ? "Your answer" : "Ask about what Claude just did"}
            placeholder={answering ? PLACEHOLDER[question.mode] : session.objective || !hasGoals ? "Ask about what Claude is building…" : "Pick a goal above, or ask about what Claude is doing…"}
            className="max-h-40 min-h-[1.6em] flex-1 resize-none bg-transparent py-1 font-serif text-[16px] leading-snug outline-none [field-sizing:content] placeholder:text-muted/80 lg:text-[15px]"
          />
          <button
            type="submit"
            disabled={session.busy || !text.trim()}
            aria-label={answering ? "Check my answer" : "Ask"}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-learn text-lsa transition disabled:opacity-30"
          >
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        </div>
      </form>
      {!compact && <p className="mt-1.5 px-1 text-[11px] text-muted">Learn mode explains Claude’s work; to change the work, use Claude’s chat.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ recap */

function Recap({ session, feed, recap, onKeepGoing, onPickAnotherGoal }: { session: LearnSession; feed: FeedEntry[]; recap: string; onKeepGoing: Props["onKeepGoing"]; onPickAnotherGoal: Props["onPickAnotherGoal"] }) {
  const memory = useMemory();
  const ep = memory.episodes.find((e) => e.id === session.id);
  const crumbs = breadcrumb(feed);
  const trail = latestTrail(feed);
  const moved = ep
    ? ep.topicIds
        .map((id) => ({ id, label: memory.topics[id]?.label ?? id, before: ep.masteryBefore[id] ?? PRIOR, after: ep.masteryAfter[id] }))
        .filter((d): d is { id: string; label: string; before: number; after: number } => d.after != null && d.after !== d.before)
    : [];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="rounded-xl border border-learn/50 bg-gradient-to-b from-learn/15 to-lsa-surface px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-learn">
        <GraduationCap size={13} /> Session recap
      </div>
      <p className="mt-1.5 font-serif text-[15px] leading-snug">{recap}</p>
      {crumbs.length > 0 && (
        <div className="mt-2.5 text-[12.5px]">
          <div className="text-muted">Covered</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-learn">
            {crumbs.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={11} className="text-muted" />}
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {moved.length > 0 && (
        <div className="mt-2.5 space-y-1.5 text-[12.5px]">
          <div className="text-muted">How your mastery moved</div>
          {moved.map((d) => (
            <div key={d.id}>
              <div className="flex justify-between">
                <span>{d.label}</span>
                <span className="font-mono text-[11.5px] text-muted">
                  {pct(d.before)} → <span className={d.after > d.before ? "text-learn" : "text-danger"}>{pct(d.after)}</span>
                </span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-lsa-border">
                <div className="absolute inset-y-0 left-0 rounded-full bg-learn/35" style={{ width: pct(d.before) }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-learn" style={{ width: pct(d.after) }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={() => onKeepGoing(trail.deeper)} className="rounded-lg bg-learn px-3 py-1.5 text-[12.5px] font-medium text-lsa">
          Keep going{trail.deeper ? `: ${trail.deeper}` : ""}
        </button>
        <button onClick={onPickAnotherGoal} className="rounded-lg border border-lsa-border px-3 py-1.5 text-[12.5px] text-text/90 hover:border-learn/60">
          Pick another goal
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function LsaCard({ children, kicker, tone, highlight, accent }: { children: React.ReactNode; kicker?: React.ReactNode; tone?: Verdict; highlight?: boolean; accent?: "note" }) {
  const rule = tone === "correct" ? "border-l-learn" : tone === "partial" ? "border-l-note" : tone === "incorrect" ? "border-l-danger" : accent === "note" ? "border-l-note" : "border-l-learn/70";
  return (
    <div className={`rounded-r-xl rounded-l-sm border border-l-[3px] border-lsa-border ${rule} bg-lsa-surface px-3.5 py-3 ${highlight ? "ring-1 ring-learn/40" : ""}`}>
      {kicker && <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-learn">{kicker}</div>}
      <div className="font-serif text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

function LearnerBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ml-8 rounded-lg border border-dashed border-lsa-border px-3 py-2 text-[13.5px]">
      <div className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  );
}

function McqInput({ probeId, options, disabled, onAnswer }: { probeId: string; options: string[]; disabled: boolean; onAnswer: Props["onAnswer"] }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="mt-3 font-sans">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = picked.includes(o);
          return (
            <button
              key={o}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o) : p.length < 3 ? [...p, o] : p))}
              className={`rounded-lg border px-2.5 py-1 font-mono text-[12.5px] ${on ? "border-learn bg-learn/15 text-learn" : "border-lsa-border bg-lsa hover:border-muted"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      <button disabled={disabled || picked.length === 0} onClick={() => onAnswer(probeId, "", picked)} className="mt-3 rounded-lg bg-learn px-3 py-1.5 text-[13px] font-medium text-lsa disabled:opacity-40">
        Lock in {picked.length ? `(${picked.length})` : ""}
      </button>
    </div>
  );
}

function Anchors({ ids, thread, label }: { ids: string[]; thread: Thread; label?: string }) {
  const items = ids.map((id) => thread.items.find((i) => i.id === id)).filter(Boolean) as Thread["items"];
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 font-sans text-[12px]">
      {label && <span className="text-muted">{label}:</span>}
      {items.map((i) =>
        i.revealed ? (
          <button key={i.id} onClick={() => focusThreadItem(i.id)} className="rounded-md border border-learn/40 px-1.5 py-0.5 font-mono text-learn hover:bg-learn/10">
            {i.title} ↗
          </button>
        ) : (
          <span key={i.id} className="rounded-md border border-dashed border-lsa-border px-1.5 py-0.5 font-mono text-muted" title="Claude hasn't written this yet">
            {i.title} · coming up
          </span>
        ),
      )}
    </div>
  );
}

function VerdictBadge({ v }: { v: Verdict }) {
  const s = { correct: "bg-learn/15 text-learn", partial: "bg-note-soft text-note", incorrect: "bg-danger-soft text-danger" }[v];
  const t = { correct: "Nailed it", partial: "Partly there", incorrect: "Not quite" }[v];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal ${s}`}>{t}</span>;
}

function Md({ children }: { children: string }) {
  return (
    <div className="prose-md">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

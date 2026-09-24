"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowDownRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
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
  MessageCircleQuestion,
  MousePointerClick,
  Mountain,
  Sparkles,
  X,
  ZoomOut,
} from "lucide-react";
import { deriveFeed } from "@/lib/learn/useLearn";
import { arcOf, breadcrumb, latestTrail, nextMoves, openProbe, pendingNudge, type NextMove, type Nudge } from "@/lib/learn/moves";
import { estimateOf, normalizeTopicId, PRIOR, type Refresher } from "@/lib/memory/model";
import { useMemory } from "@/lib/memory/store";
import type { FeedEntry, LearnAction, LearnSession, MoveKind, Objective, ProbeMode, Verdict } from "@/lib/learn/types";
import type { Thread } from "@/lib/thread/types";
import { focusThreadItem } from "@/lib/thread/focus";
import { ProgressView } from "./ProgressView";
import { Widget } from "./Widget";
import { InboxView } from "./InboxView";

export type PanelTab = "session" | "progress" | "inbox";
const TAB_LABEL: Record<PanelTab, string> = { session: "Session", progress: "Your progress", inbox: "Inbox" };

type Props = {
  thread: Thread;
  session: LearnSession | null;
  simulated: boolean;
  canStart: { messageId: string; trigger: "live" | "post_task" } | null;
  error: string | null;
  onClose: () => void;
  onStart: (messageId: string, trigger: "live" | "post_task") => void;
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
};

/**
 * The mentor: a learning companion beside Claude, deliberately styled apart from it.
 * Its contract is in its controls: it asks, checks and shows; it never does the task.
 */
export function LearnPanel(props: Props) {
  const { thread, session, simulated, error, onClose, tab, onTab, dueCount } = props;
  const feed = session ? deriveFeed(session, thread) : [];
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length, session?.busy]);

  return (
    <aside className="flex h-full w-[440px] shrink-0 flex-col border-l border-mentor-border bg-mentor">
      <header className="flex items-center gap-3 border-b border-mentor-border px-4 pt-3.5 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-learn/15 text-learn ring-1 ring-learn/40">
          <GraduationCap size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14.5px] font-semibold text-learn">
            Mentor
            {simulated && <span className="rounded-full bg-note-soft px-1.5 py-0.5 text-[10.5px] font-normal text-note">scripted mock</span>}
          </div>
          <div className="truncate text-[12px] text-muted">Asks, checks and shows. Claude does the work.</div>
        </div>
        <button onClick={onClose} aria-label="Close mentor" className="rounded-md p-1 text-muted hover:bg-mentor-surface hover:text-text">
          <X size={16} />
        </button>
      </header>
      <div className="flex gap-4 border-b border-mentor-border px-4 text-[13px]">
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
          {session?.objective && <SessionHeader session={session} feed={feed} />}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!session && <NoSession canStart={props.canStart} onStart={props.onStart} />}
            {session && feed.map((e, i) => <Entry key={i} {...props} entry={e} feed={feed} session={session} />)}
            {session?.busy && <Thinking objectivesPending={!feed.some((e) => e.kind === "action" && e.action.kind === "objectives")} />}
            {session && <NextMoves moves={nextMoves(session, feed)} onMove={props.onMove} />}
            {error && <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</div>}
            <div ref={bottom} />
          </div>
          {session && <NudgeBar nudge={pendingNudge(session, thread.items)} onNudge={props.onNudge} />}
          {session && <Toolbar session={session} feed={feed} onMove={props.onMove} onAsk={props.onAsk} />}
        </>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ header */

function SessionHeader({ session, feed }: { session: LearnSession; feed: FeedEntry[] }) {
  const arc = arcOf(session, feed);
  const crumbs = breadcrumb(feed);
  const current = Math.min(arc.done + 1, arc.target);
  return (
    <div className="border-b border-mentor-border bg-mentor-surface/50 px-4 py-2.5">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="truncate font-medium text-text/90">{session.objective?.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted" aria-label={`Move ${current} of ${arc.target}`}>
          {session.ended ? "Done" : arc.complete ? "Wrapping up" : `Move ${current} of ${arc.target}`}
          <span className="flex gap-1">
            {Array.from({ length: arc.target }).map((_, i) => (
              <span key={i} className={`h-1.5 w-4 rounded-full ${i < arc.done ? "bg-learn" : i === arc.done && !session.ended ? "bg-learn/40" : "bg-mentor-border"}`} />
            ))}
          </span>
        </span>
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

function NoSession({ canStart, onStart }: Pick<Props, "canStart" | "onStart">) {
  // No blank slate: if there's a learnable task, start straight away and show goal cards (once per turn).
  const started = useRef<string | null>(null);
  const turnKey = canStart ? `${canStart.messageId}:${canStart.trigger}` : null;
  useEffect(() => {
    if (!canStart || started.current === turnKey) return;
    started.current = turnKey;
    onStart(canStart.messageId, canStart.trigger);
  }, [canStart, turnKey, onStart]);
  if (canStart) return <GoalSkeleton />;
  return (
    <div className="rounded-xl border border-mentor-border bg-mentor-surface p-4 text-[14px] leading-relaxed">
      <p className="font-serif text-[16px]">I’m your mentor for whatever Claude is working on.</p>
      <p className="mt-2 text-muted">Give Claude a task. While it works, I’ll offer a few things worth learning from it, then quiz you, check your thinking against Claude’s actual code, and show you how it works.</p>
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
        <div key={i} className="h-[74px] animate-pulse rounded-xl border border-mentor-border bg-mentor-surface/60" />
      ))}
    </div>
  );
}

function Thinking({ objectivesPending }: { objectivesPending: boolean }) {
  if (objectivesPending) return <GoalSkeleton />;
  return (
    <div className="flex items-center gap-2 px-1 text-[13px] text-muted">
      <Loader2 size={14} className="animate-spin" /> <span className="shimmer">Mentor is thinking…</span>
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
        <MentorCard tone={entry.verdict} kicker={<><Compass size={13} /> Cross-check <VerdictBadge v={entry.verdict} /></>}>
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
        </MentorCard>
      );
    }
    case "feedback":
      return (
        <MentorCard tone={entry.verdict} kicker={<VerdictBadge v={entry.verdict} />}>
          <Md>{entry.text}</Md>
          <Anchors ids={entry.anchors} thread={p.thread} label="See it in Claude’s work" />
        </MentorCard>
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
        <MentorCard kicker={<><M.icon size={13} /> {M.label}</>} highlight={open}>
          <Md>{action.question}</Md>
          <Anchors ids={action.anchors} thread={thread} label="About" />
          {open && <ProbeInput probeId={action.id} mode={action.mode} options={action.format === "mcq" ? action.options : []} disabled={session.busy} onAnswer={p.onAnswer} />}
        </MentorCard>
      );
    }
    case "hint":
      return (
        <MentorCard kicker={<><Lightbulb size={13} /> Hint</>} accent="note">
          <Md>{action.text}</Md>
          <Anchors ids={action.anchors} thread={thread} />
        </MentorCard>
      );
    case "explain":
      return (
        <MentorCard kicker={<><HelpCircle size={13} /> Explanation</>}>
          <Md>{action.text}</Md>
          <Anchors ids={action.anchors} thread={thread} label="In Claude’s code" />
        </MentorCard>
      );
    case "demonstrate":
      return (
        <MentorCard kicker={<><MousePointerClick size={13} /> Try it · {action.title}</>}>
          <div className="font-sans">
            <Widget state={session.widgets[action.id]} title={action.title} onEngaged={p.onWidgetEngaged} onRetry={() => p.onWidgetRetry(action)} />
          </div>
          <Anchors ids={action.anchors} thread={thread} label="Mirrors" />
        </MentorCard>
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
      <p className="mb-2 px-1 font-serif text-[15.5px] leading-snug">Claude is doing the work. Here’s what you could learn from it. Pick one:</p>
      <ol className="space-y-2">
        {open.map((o, i) => {
          const K = KIND[o.kind ?? "core"] ?? KIND.core;
          return (
            <li key={`${o.topicId}-${i}`}>
              <button onClick={() => onPick(o)} className="group w-full rounded-xl border border-mentor-border bg-mentor-surface px-3.5 py-3 text-left transition hover:border-learn/60 hover:bg-learn/10">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-learn/90">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-learn/20 text-[10px]">{i + 1}</span>
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
        <div className="mt-2 rounded-lg border border-mentor-border px-3 py-2 text-[12.5px] text-muted">
          <button onClick={() => setShowSolid((v) => !v)} className="flex w-full items-center gap-1.5 text-left">
            <ChevronDown size={13} className={showSolid ? "" : "-rotate-90"} /> Already solid ({solid.length}): {solid.map((o) => o.topicLabel ?? o.topicId).join(", ")}
          </button>
          {showSolid && (
            <ul className="mt-2 space-y-1.5">
              {solid.map((o) => (
                <li key={o.topicId}>
                  <button onClick={() => onPick(o)} className="w-full rounded-md px-2 py-1 text-left hover:bg-mentor-surface">
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

function NextMoves({ moves, onMove }: { moves: NextMove[]; onMove: Props["onMove"] }) {
  if (moves.length === 0) return null;
  return (
    <div className="pt-1" aria-label="Where next">
      <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-muted">Where next?</div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${moves.length}, minmax(0, 1fr))` }}>
        {moves.map((mv) => {
          const Icon = MOVE_ICON[mv.move];
          return (
            <button
              key={mv.move}
              onClick={() => onMove(mv.move, mv.target, mv.target ? `${mv.label}: ${mv.target}` : mv.label)}
              title={mv.hint}
              className="rounded-lg border border-learn/35 bg-learn/5 px-2.5 py-2 text-left transition hover:border-learn/70 hover:bg-learn/15"
            >
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-learn">
                <Icon size={13} /> {mv.label}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted">{mv.target || mv.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NudgeBar({ nudge, onNudge }: { nudge: Nudge | null; onNudge: Props["onNudge"] }) {
  if (!nudge) return null;
  return (
    <div className="appear mx-3 mb-2 rounded-xl border border-learn/50 bg-learn/10 px-3.5 py-2.5 shadow-lg" role="status">
      <div className="flex items-start gap-2">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-learn" />
        <p className="text-[13.5px] leading-snug">{nudge.text}</p>
      </div>
      <div className="mt-2 flex gap-2 pl-6">
        <button onClick={() => onNudge(nudge, true)} className="rounded-lg bg-learn px-3 py-1 text-[12.5px] font-medium text-mentor">
          {nudge.cta}
        </button>
        <button onClick={() => onNudge(nudge, false)} className="rounded-lg px-2 py-1 text-[12.5px] text-muted hover:text-text">
          Later
        </button>
      </div>
    </div>
  );
}

const TOOLS: { move: MoveKind; label: string; icon: typeof Compass; title: string }[] = [
  { move: "quiz", label: "Quiz me", icon: HelpCircle, title: "A question on what you're learning" },
  { move: "explain", label: "Explain", icon: BookOpen, title: "A short explanation grounded in Claude's code" },
  { move: "show", label: "Show me", icon: MousePointerClick, title: "A hands-on demo or the exact code" },
  { move: "challenge", label: "Challenge me", icon: Flame, title: "A harder what-if" },
];

/** The mentor's contract, as controls. Free-form questions are secondary. */
function Toolbar({ session, feed, onMove, onAsk }: { session: LearnSession; feed: FeedEntry[]; onMove: Props["onMove"]; onAsk: Props["onAsk"] }) {
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");
  const ready = !!session.objective && !session.busy && !session.ended;
  const trail = latestTrail(feed);
  return (
    <div className="border-t border-mentor-border bg-mentor px-3 pt-2 pb-3">
      {asking && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || !ready) return;
            onAsk(text.trim());
            setText("");
            setAsking(false);
          }}
          className="mb-2 rounded-lg border border-mentor-border bg-mentor-surface px-3 py-2"
        >
          <label htmlFor="mentor-ask" className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Ask about what Claude just did
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="mentor-ask"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
              placeholder="e.g. why did Claude pin the algorithm?"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted/70"
            />
            <button type="submit" disabled={!ready || !text.trim()} aria-label="Ask the mentor" className="flex h-7 w-7 items-center justify-center rounded-md bg-learn text-mentor disabled:opacity-35">
              <ArrowUp size={14} />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">For changes to the work itself, ask Claude in the main chat.</p>
        </form>
      )}
      <div className="grid grid-cols-[1fr_1fr_1fr_1.3fr] gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.move}
            disabled={!ready}
            title={ready ? t.title : "Pick a goal first"}
            onClick={() => onMove(t.move, t.move === "challenge" ? trail.deeper : "", t.label)}
            className="flex min-w-0 items-center justify-center gap-1 rounded-full border border-mentor-border bg-mentor-surface px-1 py-1.5 text-[12px] whitespace-nowrap text-text/90 transition hover:border-learn/60 hover:text-learn disabled:opacity-40"
          >
            <t.icon size={12} className="shrink-0" /> {t.label}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] text-muted">I ask, check and show. Claude does the work.</span>
        <button
          onClick={() => setAsking((v) => !v)}
          disabled={!session.objective}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] text-muted hover:text-text disabled:opacity-40"
          aria-expanded={asking}
        >
          <MessageCircleQuestion size={13} /> Ask
        </button>
      </div>
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
    <div className="rounded-xl border border-learn/50 bg-gradient-to-b from-learn/15 to-mentor-surface px-4 py-3.5">
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
              <div className="relative mt-1 h-1.5 rounded-full bg-mentor-border">
                <div className="absolute inset-y-0 left-0 rounded-full bg-learn/35" style={{ width: pct(d.before) }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-learn" style={{ width: pct(d.after) }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={() => onKeepGoing(trail.deeper)} className="rounded-lg bg-learn px-3 py-1.5 text-[12.5px] font-medium text-mentor">
          Keep going{trail.deeper ? `: ${trail.deeper}` : ""}
        </button>
        <button onClick={onPickAnotherGoal} className="rounded-lg border border-mentor-border px-3 py-1.5 text-[12.5px] text-text/90 hover:border-learn/60">
          Pick another goal
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function MentorCard({ children, kicker, tone, highlight, accent }: { children: React.ReactNode; kicker?: React.ReactNode; tone?: Verdict; highlight?: boolean; accent?: "note" }) {
  const rule = tone === "correct" ? "border-l-learn" : tone === "partial" ? "border-l-note" : tone === "incorrect" ? "border-l-danger" : accent === "note" ? "border-l-note" : "border-l-learn/70";
  return (
    <div className={`rounded-r-xl rounded-l-sm border border-l-[3px] border-mentor-border ${rule} bg-mentor-surface px-3.5 py-3 ${highlight ? "ring-1 ring-learn/40" : ""}`}>
      {kicker && <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-learn">{kicker}</div>}
      <div className="font-serif text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

function LearnerBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ml-8 rounded-lg border border-dashed border-mentor-border px-3 py-2 text-[13.5px]">
      <div className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  );
}

const PLACEHOLDER: Record<ProbeMode, string> = {
  approach: "Your approach…",
  predict: "Your prediction, in your own words…",
  explain_back: "Explain it in your own words…",
  what_if: "What would happen?",
};

function ProbeInput({ probeId, mode, options, disabled, onAnswer }: { probeId: string; mode: ProbeMode; options: string[]; disabled: boolean; onAnswer: Props["onAnswer"] }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  if (options.length) {
    return (
      <div className="mt-3 font-sans">
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = picked.includes(o);
            return (
              <button
                key={o}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o) : p.length < 3 ? [...p, o] : p))}
                className={`rounded-lg border px-2.5 py-1 font-mono text-[12.5px] ${on ? "border-learn bg-learn/15 text-learn" : "border-mentor-border bg-mentor hover:border-muted"}`}
              >
                {o}
              </button>
            );
          })}
        </div>
        <button disabled={disabled || picked.length === 0} onClick={() => onAnswer(probeId, "", picked)} className="mt-3 rounded-lg bg-learn px-3 py-1.5 text-[13px] font-medium text-mentor disabled:opacity-40">
          Lock in {picked.length ? `(${picked.length})` : ""}
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-3 font-sans"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAnswer(probeId, text.trim(), []);
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label="Your answer"
        placeholder={PLACEHOLDER[mode]}
        className="w-full resize-none rounded-lg border border-mentor-border bg-mentor px-3 py-2 text-[14px] outline-none placeholder:text-muted focus:border-learn/60"
      />
      <button type="submit" disabled={disabled || !text.trim()} className="mt-2 rounded-lg bg-learn px-3 py-1.5 text-[13px] font-medium text-mentor disabled:opacity-40">
        Check my answer
      </button>
    </form>
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
          <span key={i.id} className="rounded-md border border-dashed border-mentor-border px-1.5 py-0.5 font-mono text-muted" title="Claude hasn't written this yet">
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

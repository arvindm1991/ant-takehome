"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, BookOpen, Check, CircleHelp, Compass, FlaskConical, GraduationCap, Lightbulb, Loader2, MousePointerClick, Sparkles, X } from "lucide-react";
import { deriveFeed } from "@/lib/learn/useLearn";
import { ProgressView } from "./ProgressView";
import { Widget } from "./Widget";
import type { FeedEntry, LearnAction, LearnSession, Objective, ProbeMode, Verdict } from "@/lib/learn/types";
import type { Thread } from "@/lib/thread/types";
import { focusThreadItem } from "@/lib/thread/focus";

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
  onWidgetEngaged: () => void;
  onWidgetRetry: (action: Extract<LearnAction, { kind: "demonstrate" }>) => void;
};

export function LearnPanel({ thread, session, simulated, canStart, error, onClose, onStart, onObjective, onAnswer, onAsk, onWidgetEngaged, onWidgetRetry }: Props) {
  const [tab, setTab] = useState<"session" | "progress">("session");
  const feed = session ? deriveFeed(session, thread) : [];
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length, session?.busy]);
  const answered = new Set(feed.filter((e) => e.kind === "answer").map((e) => (e as { probeId: string }).probeId));
  const lastProbeId = [...feed].reverse().find((e) => e.kind === "action" && e.action.kind === "probe");
  // After a hint, the latest question reopens for another attempt.
  const lastAction = [...feed].reverse().find((e) => e.kind === "action");
  if (lastAction?.kind === "action" && lastAction.action.kind === "hint" && lastProbeId?.kind === "action" && lastProbeId.action.kind === "probe") {
    answered.delete(lastProbeId.action.id);
  }

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-border bg-sidebar">
      <header className="flex items-center gap-2 border-b border-border px-4 pt-3.5 pb-2">
        <GraduationCap size={17} className="text-learn" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-medium">
            Learning
            {simulated && <span className="rounded-full bg-note-soft px-1.5 py-0.5 text-[10.5px] font-normal text-note">scripted mock</span>}
          </div>
          <div className="truncate text-[12px] text-muted">{thread.title}</div>
        </div>
        <button onClick={onClose} aria-label="Close learning panel" className="rounded-md p-1 text-muted hover:bg-raised hover:text-text">
          <X size={16} />
        </button>
      </header>
      <div className="flex gap-4 border-b border-border px-4 text-[13px]">
        {(["session", "progress"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-2 capitalize ${tab === t ? "border-learn font-medium" : "border-transparent text-muted hover:text-text"}`}>
            {t === "progress" ? "Your progress" : "Session"}
          </button>
        ))}
        <span className="py-2 text-muted/60" title="Refreshers arrive in a later milestone">
          Inbox
        </span>
      </div>

      {tab === "progress" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ProgressView activeThreadId={thread.id} />
        </div>
      ) : (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!session && <EmptyPanel canStart={canStart} onStart={onStart} />}
        {session &&
          feed.map((e, i) => (
            <Entry
              key={i}
              entry={e}
              thread={thread}
              session={session}
              answered={answered}
              isLatestProbe={e.kind === "action" && lastProbeId === e}
              onObjective={onObjective}
              onAnswer={onAnswer}
              onWidgetEngaged={onWidgetEngaged}
              onWidgetRetry={onWidgetRetry}
            />
          ))}
        {session?.busy && (
          <div className="flex items-center gap-2 px-1 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> <span className="shimmer">Thinking about what’s worth learning here…</span>
          </div>
        )}
        {error && <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</div>}
        <div ref={bottom} />
      </div>
      )}

      {session && tab === "session" && <AskBox onAsk={onAsk} disabled={session.busy} />}
    </aside>
  );
}

function EmptyPanel({ canStart, onStart }: Pick<Props, "canStart" | "onStart">) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-[14px] leading-relaxed">
      <p className="font-medium">Learn mode is on.</p>
      <p className="mt-1 text-muted">
        Give Claude a task. While it works, I’ll help you understand what it’s doing: short questions grounded in its actual work. The task never waits on
        you.
      </p>
      {canStart && (
        <button onClick={() => onStart(canStart.messageId, canStart.trigger)} className="mt-3 rounded-lg bg-learn-soft px-3 py-1.5 text-[13.5px] font-medium text-learn hover:bg-learn/20">
          Start learning from this task
        </button>
      )}
    </div>
  );
}

const extras = (e: Extract<FeedEntry, { kind: "reveal" }>) => e.picked.filter((p) => !e.actual.some((a) => a.path === p));

const MODE: Record<ProbeMode, { label: string; icon: typeof Compass }> = {
  approach: { label: "Approach", icon: Compass },
  predict: { label: "Predict", icon: Sparkles },
  explain_back: { label: "Explain back", icon: BookOpen },
  what_if: { label: "What if", icon: FlaskConical },
};

function Entry({
  entry,
  thread,
  session,
  answered,
  isLatestProbe,
  onObjective,
  onAnswer,
  onWidgetEngaged,
  onWidgetRetry,
}: {
  entry: FeedEntry;
  thread: Thread;
  session: LearnSession;
  answered: Set<string>;
  isLatestProbe: boolean;
  onObjective: (o: Objective) => void;
  onAnswer: Props["onAnswer"];
  onWidgetEngaged: Props["onWidgetEngaged"];
  onWidgetRetry: Props["onWidgetRetry"];
}) {
  switch (entry.kind) {
    case "action":
      return <ActionCard
          action={entry.action}
          thread={thread}
          session={session}
          answered={answered}
          isLatestProbe={isLatestProbe}
          onObjective={onObjective}
          onAnswer={onAnswer}
          onWidgetEngaged={onWidgetEngaged}
          onWidgetRetry={onWidgetRetry}
        />;
    case "answer":
      return (
        <div className="ml-auto max-w-[85%] rounded-2xl bg-raised px-3.5 py-2 text-[14px]">
          {entry.selected.length ? entry.selected.map((s) => <code key={s} className="mr-1.5 font-mono text-[12.5px]">{s}</code>) : entry.text}
        </div>
      );
    case "user":
      return <div className="ml-auto max-w-[85%] rounded-2xl bg-raised px-3.5 py-2 text-[14px]">{entry.text}</div>;
    case "waiting":
      return (
        <div className="flex items-center gap-2 px-1 text-[12.5px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-learn" /> {entry.text}
        </div>
      );
    case "reveal":
      return (
        <Card tone={entry.verdict}>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-muted">
            <Compass size={13} /> Cross-check <VerdictBadge v={entry.verdict} />
          </div>
          <p className="mb-2 text-[14px]">Here’s where Claude actually looked first, and why:</p>
          <ul className="space-y-1.5">
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
          {extras(entry).length > 0 && (
            <p className="mt-2 text-[13px] text-muted">
              You also picked{" "}
              {extras(entry).map((p) => (
                  <code key={p} className="mr-1 font-mono text-[12px]">
                    {p}
                  </code>
                ))}
              . Claude skipped {extras(entry).length > 1 ? "those" : "that"}. What would it have told you about adding login?
            </p>
          )}
        </Card>
      );
    case "feedback":
      return (
        <Card tone={entry.verdict}>
          <div className="mb-1.5 flex items-center gap-2">
            <VerdictBadge v={entry.verdict} />
          </div>
          <Md>{entry.text}</Md>
          <Anchors ids={entry.anchors} thread={thread} label="See it in Claude's work" />
        </Card>
      );
  }
}

function ActionCard({
  action,
  thread,
  session,
  answered,
  isLatestProbe,
  onObjective,
  onAnswer,
  onWidgetEngaged,
  onWidgetRetry,
}: {
  action: LearnAction;
  thread: Thread;
  session: LearnSession;
  answered: Set<string>;
  isLatestProbe: boolean;
  onObjective: (o: Objective) => void;
  onAnswer: Props["onAnswer"];
  onWidgetEngaged: Props["onWidgetEngaged"];
  onWidgetRetry: Props["onWidgetRetry"];
}) {
  switch (action.kind) {
    case "objectives":
      return (
        <div>
          <p className="mb-2 px-1 text-[14px]">Claude’s doing the work. Pick one thing you’d like to really understand from it:</p>
          <div className="space-y-2">
            {action.objectives.map((o) => {
              const chosen = session.objective?.topicId === o.topicId;
              const disabled = !!session.objective && !chosen;
              return (
                <button
                  key={o.topicId}
                  disabled={!!session.objective}
                  onClick={() => onObjective(o)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition ${
                    chosen ? "border-learn/60 bg-learn-soft" : disabled ? "border-border opacity-45" : "border-border bg-surface hover:border-learn/50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    {chosen && <Check size={14} className="text-learn" />} {o.label}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">{o.why}</div>
                </button>
              );
            })}
          </div>
        </div>
      );
    case "probe": {
      const M = MODE[action.mode];
      return (
        <Card>
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-learn">
            <M.icon size={13} /> {M.label}
          </div>
          <Md>{action.question}</Md>
          <Anchors ids={action.anchors} thread={thread} label="About" />
          {!answered.has(action.id) && isLatestProbe && (
            <ProbeInput probeId={action.id} mode={action.mode} options={action.format === "mcq" ? action.options : []} disabled={session.busy} onAnswer={onAnswer} />
          )}
        </Card>
      );
    }
    case "hint":
      return (
        <Card>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-note">
            <Lightbulb size={13} /> Hint
          </div>
          <Md>{action.text}</Md>
          <Anchors ids={action.anchors} thread={thread} />
          <p className="mt-2 text-[12.5px] text-muted">Give the question above another try.</p>
        </Card>
      );
    case "explain":
      return (
        <Card>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-muted">
            <CircleHelp size={13} /> Explanation
          </div>
          <Md>{action.text}</Md>
          <Anchors ids={action.anchors} thread={thread} />
        </Card>
      );
    case "demonstrate":
      return (
        <Card>
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-learn">
            <MousePointerClick size={13} /> Try it · {action.title}
          </div>
          <Widget state={session.widgets[action.id]} title={action.title} onEngaged={onWidgetEngaged} onRetry={() => onWidgetRetry(action)} />
          <Anchors ids={action.anchors} thread={thread} label="Mirrors" />
        </Card>
      );
    case "end":
      return (
        <Card tone="correct">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-learn">
            <GraduationCap size={13} /> Session complete
          </div>
          <Md>{action.recap}</Md>
        </Card>
      );
  }
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
      <div className="mt-3">
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = picked.includes(o);
            return (
              <button
                key={o}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o) : p.length < 3 ? [...p, o] : p))}
                className={`rounded-lg border px-2.5 py-1 font-mono text-[12.5px] ${on ? "border-learn bg-learn-soft text-learn" : "border-border bg-bg/40 hover:border-muted"}`}
              >
                {o}
              </button>
            );
          })}
        </div>
        <button
          disabled={disabled || picked.length === 0}
          onClick={() => onAnswer(probeId, "", picked)}
          className="mt-3 rounded-lg bg-learn px-3 py-1.5 text-[13px] font-medium text-bg disabled:opacity-40"
        >
          Lock in {picked.length ? `(${picked.length})` : ""}
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAnswer(probeId, text.trim(), []);
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={PLACEHOLDER[mode]}
        className="w-full resize-none rounded-lg border border-border bg-bg/50 px-3 py-2 text-[14px] outline-none placeholder:text-muted focus:border-learn/60"
      />
      <button type="submit" disabled={disabled || !text.trim()} className="mt-2 rounded-lg bg-learn px-3 py-1.5 text-[13px] font-medium text-bg disabled:opacity-40">
        Commit answer
      </button>
    </form>
  );
}

function AskBox({ onAsk, disabled }: { onAsk: (t: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || disabled) return;
        onAsk(text.trim());
        setText("");
      }}
      className="m-3 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 focus-within:border-learn/50"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask about what Claude is doing…"
        className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted"
      />
      <button type="submit" disabled={disabled || !text.trim()} aria-label="Ask" className="flex h-7 w-7 items-center justify-center rounded-lg bg-learn text-bg disabled:opacity-35">
        <ArrowUp size={15} />
      </button>
    </form>
  );
}

function Anchors({ ids, thread, label }: { ids: string[]; thread: Thread; label?: string }) {
  const items = ids.map((id) => thread.items.find((i) => i.id === id)).filter(Boolean) as Thread["items"];
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
      {label && <span className="text-muted">{label}:</span>}
      {items.map((i) =>
        i.revealed ? (
          <button key={i.id} onClick={() => focusThreadItem(i.id)} className="rounded-md border border-learn/40 px-1.5 py-0.5 font-mono text-learn hover:bg-learn-soft">
            {i.title} ↗
          </button>
        ) : (
          <span key={i.id} className="rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-muted" title="Claude hasn't written this yet">
            {i.title} · coming up
          </span>
        ),
      )}
    </div>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone?: Verdict }) {
  const border = tone === "correct" ? "border-learn/40" : tone === "partial" ? "border-note/40" : tone === "incorrect" ? "border-danger/40" : "border-border";
  return <div className={`rounded-xl border ${border} bg-surface px-3.5 py-3`}>{children}</div>;
}

function VerdictBadge({ v }: { v: Verdict }) {
  const s = { correct: "bg-learn-soft text-learn", partial: "bg-note-soft text-note", incorrect: "bg-danger-soft text-danger" }[v];
  const t = { correct: "Nailed it", partial: "Partly there", incorrect: "Not quite" }[v];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal ${s}`}>{t}</span>;
}

function Md({ children }: { children: string }) {
  return (
    <div className="prose-md text-[14px] leading-relaxed">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { Composer, SuggestionList } from "@/components/Composer";
import { LearnPanel } from "@/components/learn/LearnPanel";
import { LiveLearnChip, PostTaskLearnChip, RefresherChip } from "@/components/learn/LearnChips";
import type { PanelTab } from "@/components/learn/LearnPanel";
import { Sidebar } from "@/components/Sidebar";
import { ThreadView, type ThreadSlots } from "@/components/ThreadView";
import { TopBar } from "@/components/TopBar";
import { useLearn } from "@/lib/learn/useLearn";
import { useThreads } from "@/lib/thread/useThreads";
import { useDeployStatus } from "@/lib/status";
import { useMemory } from "@/lib/memory/store";
import { dueRefreshers, estimateOf, normalizeTopicId, type Refresher } from "@/lib/memory/model";
import type { Learnability } from "@/lib/learn/types";

export function App() {
  // The main thread only exposes a generic "prompt sent" observer; learn mode subscribes to it.
  const onPromptSent = useRef<(threadId: string, messageId: string, prompt: string) => void>(undefined);
  const { threads, active, activeId, setActiveId, newChat, send } = useThreads({
    onPromptSent: (t, m, p) => onPromptSent.current?.(t, m, p),
  });
  const learn = useLearn(threads, activeId);
  const status = useDeployStatus();
  const memory = useMemory();
  // SPEC §11: suggest learning only if some topic isn't mastered yet.
  const worthSuggesting = (lb?: Learnability) =>
    !!lb?.learnable && (lb.topics.length === 0 || lb.topics.some((t) => (estimateOf(memory, normalizeTopicId(t.id)) ?? 0) < 0.7));
  useEffect(() => {
    onPromptSent.current = learn.onPromptSent;
  });

  const [tab, setTab] = useState<PanelTab>("session");
  const dueCount = dueRefreshers(memory).length;
  // A live/post-task session already covers this message (refresher sessions don't).
  const learnedHere = (messageId: string) => session?.messageId === messageId && (session.trigger === "live" || session.trigger === "post_task");

  const openRefresher = (r: Refresher) => {
    if (!r.source) return;
    setActiveId(r.source.threadId);
    setTab("session");
    learn.startRefresher(r.source.threadId, r.source.messageId, { id: r.topicId, label: r.label, daysSince: r.daysSince }, "refresher", null);
  };

  const busy = active.turns.some((t) => t.status === "thinking" || t.status === "revealing");
  const empty = active.items.length === 0;
  const session = learn.session;

  // Latest learnable turn in this thread without a learning session yet.
  const canStart = (() => {
    const turn = active.turns.at(-1);
    if (!turn) return null;
    const lb = learn.learnability(active.id, turn.messageId);
    if (!lb?.learnable || learnedHere(turn.messageId)) return null;
    return { messageId: turn.messageId, trigger: turn.status === "done" ? ("post_task" as const) : ("live" as const) };
  })();

  const toggleLearn = () => {
    if (learn.panelOpen) return learn.setPanelOpen(false);
    learn.setPanelOpen(true);
    setTab("session");
    if (canStart) learn.start(active.id, canStart.messageId, canStart.trigger);
  };

  const slots: ThreadSlots = {
    afterPrompt: (messageId) => {
      const lb = learn.learnability(active.id, messageId);
      const turn = active.turns.find((t) => t.messageId === messageId);
      if (session?.messageId === messageId) return null;
      // One inline nudge per task: a contextual refresher takes precedence (SPEC §10.3).
      const nudge = learn.contextual(active.id, messageId);
      if (nudge) {
        if (nudge.dismissed) return null;
        return (
          <RefresherChip
            label={nudge.label}
            daysSince={nudge.daysSince}
            interleave={nudge.interleave}
            onAccept={() => {
              setTab("session");
              learn.acceptContextual(active.id, messageId);
            }}
            onDismiss={() => learn.dismissContextual(active.id, messageId)}
          />
        );
      }
      if (!worthSuggesting(lb) || turn?.status === "done") return null;
      return <LiveLearnChip topics={lb.topics} onClick={() => learn.start(active.id, messageId, "live")} />;
    },
    afterTurn: (messageId) => {
      const lb = learn.learnability(active.id, messageId);
      const turn = active.turns.find((t) => t.messageId === messageId);
      if (!worthSuggesting(lb) || turn?.status !== "done" || session?.messageId === messageId || learn.contextual(active.id, messageId)) return null;
      return <PostTaskLearnChip onClick={() => learn.start(active.id, messageId, "post_task")} />;
    },
  };

  return (
    <div className="flex h-full">
      <Sidebar threads={threads} activeId={activeId} onSelect={setActiveId} onNew={newChat} />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar learnOn={learn.panelOpen} onToggleLearn={toggleLearn} dueCount={dueCount}
          status={status}
          onBell={() => {
            learn.setPanelOpen(true);
            setTab("inbox");
          }}
        />
        {empty ? (
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-[22vh]">
            <h1 className="mb-10 flex items-center gap-3 font-serif text-[46px] font-light tracking-tight">
              <Spark /> Back at it, Arvind
            </h1>
            <div className="w-full max-w-[720px]">
              <Composer onSend={send} disabled={busy} variant="hero" />
              <div className="mt-12">
                <SuggestionList onPick={send} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto pt-14">
              <ThreadView thread={active} slots={slots} />
            </div>
            <div className="mx-auto w-full max-w-3xl px-6 pb-4">
              <Composer onSend={send} disabled={busy} variant="docked" />
            </div>
          </>
        )}
      </main>
      {learn.panelOpen && (
        <LearnPanel
          thread={active}
          session={session}
          simulated={status ? !status.learningAgent.live : false}
          canStart={canStart}
          error={learn.error}
          onClose={() => learn.setPanelOpen(false)}
          onStart={(m, t) => {
            setTab("session");
            learn.start(active.id, m, t);
          }}
          onObjective={(o) => learn.selectObjective(active.id, o)}
          onAnswer={(p, text, sel) => learn.answer(active.id, p, text, sel)}
          onAsk={(text) => learn.ask(active.id, text)}
          onWidgetEngaged={learn.widgetEngaged}
          onWidgetRetry={(a) => learn.retryWidget(active.id, a)}
          tab={tab}
          onTab={setTab}
          onOpenRefresher={openRefresher}
          threadExists={(id) => threads.some((t) => t.id === id)}
          dueCount={dueCount}
        />
      )}
    </div>
  );
}

/** Generic 8-point spark: a nod to the reference, not the Claude logo. */
function Spark() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden className="text-accent">
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="11" y="1.5" width="2" height="9" rx="1" fill="currentColor" transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}

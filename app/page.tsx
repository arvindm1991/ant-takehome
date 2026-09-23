"use client";
import { useEffect, useMemo, useRef } from "react";
import { Composer, SuggestionList } from "@/components/Composer";
import { LearnPanel } from "@/components/learn/LearnPanel";
import { LiveLearnChip, PostTaskLearnChip } from "@/components/learn/LearnChips";
import { Sidebar } from "@/components/Sidebar";
import { ThreadView, type ThreadSlots } from "@/components/ThreadView";
import { TopBar } from "@/components/TopBar";
import { useLearn } from "@/lib/learn/useLearn";
import { useThreads } from "@/lib/thread/useThreads";
import { useDeployStatus } from "@/lib/status";
import { useMemory } from "@/lib/memory/store";
import { estimateOf, normalizeTopicId } from "@/lib/memory/model";
import type { Learnability } from "@/lib/learn/types";

export default function Home() {
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

  const busy = active.turns.some((t) => t.status === "thinking" || t.status === "revealing");
  const empty = active.items.length === 0;
  const session = learn.session;

  // Latest learnable turn in this thread without a learning session yet.
  const canStart = useMemo(() => {
    const turn = active.turns.at(-1);
    if (!turn) return null;
    const lb = learn.learnability(active.id, turn.messageId);
    if (!lb?.learnable || session?.messageId === turn.messageId) return null;
    return { messageId: turn.messageId, trigger: turn.status === "done" ? ("post_task" as const) : ("live" as const) };
  }, [active, learn, session]);

  const toggleLearn = () => {
    if (learn.panelOpen) return learn.setPanelOpen(false);
    learn.setPanelOpen(true);
    if (canStart) learn.start(active.id, canStart.messageId, canStart.trigger);
  };

  const slots: ThreadSlots = {
    afterPrompt: (messageId) => {
      const lb = learn.learnability(active.id, messageId);
      const turn = active.turns.find((t) => t.messageId === messageId);
      if (!worthSuggesting(lb) || turn?.status === "done" || session?.messageId === messageId) return null;
      return <LiveLearnChip topics={lb.topics} onClick={() => learn.start(active.id, messageId, "live")} />;
    },
    afterTurn: (messageId) => {
      const lb = learn.learnability(active.id, messageId);
      const turn = active.turns.find((t) => t.messageId === messageId);
      if (!worthSuggesting(lb) || turn?.status !== "done" || session?.messageId === messageId) return null;
      return <PostTaskLearnChip onClick={() => learn.start(active.id, messageId, "post_task")} />;
    },
  };

  return (
    <div className="flex h-full">
      <Sidebar threads={threads} activeId={activeId} onSelect={setActiveId} onNew={newChat} />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar learnOn={learn.panelOpen} onToggleLearn={toggleLearn} dueCount={0} status={status} />
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
          onStart={(m, t) => learn.start(active.id, m, t)}
          onObjective={(o) => learn.selectObjective(active.id, o)}
          onAnswer={(p, text, sel) => learn.answer(active.id, p, text, sel)}
          onAsk={(text) => learn.ask(active.id, text)}
          onWidgetEngaged={learn.widgetEngaged}
          onWidgetRetry={(a) => learn.retryWidget(active.id, a)}
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

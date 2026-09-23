"use client";
import { useState } from "react";
import { Composer, SuggestionList } from "@/components/Composer";
import { Sidebar } from "@/components/Sidebar";
import { ThreadView } from "@/components/ThreadView";
import { TopBar } from "@/components/TopBar";
import { useThreads } from "@/lib/thread/useThreads";

export default function Home() {
  const { threads, active, activeId, setActiveId, newChat, send } = useThreads();
  const [learnOn, setLearnOn] = useState(false);

  const busy = active.turns.some((t) => t.status === "thinking" || t.status === "revealing");
  const simulated = threads.some((t) => t.turns.some((x) => x.simulated));
  const empty = active.items.length === 0;

  return (
    <div className="flex h-full">
      <Sidebar threads={threads} activeId={activeId} onSelect={setActiveId} onNew={newChat} />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar learnOn={learnOn} onToggleLearn={() => setLearnOn((v) => !v)} dueCount={0} simulated={simulated} />
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
              <ThreadView thread={active} />
            </div>
            <div className="mx-auto w-full max-w-3xl px-6 pb-4">
              <Composer onSend={send} disabled={busy} variant="docked" />
            </div>
          </>
        )}
      </main>
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

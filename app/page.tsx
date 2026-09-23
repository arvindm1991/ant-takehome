"use client";
import { useState } from "react";
import { Composer } from "@/components/Composer";
import { Sidebar } from "@/components/Sidebar";
import { ThreadView } from "@/components/ThreadView";
import { TopBar } from "@/components/TopBar";
import { useThreads } from "@/lib/thread/useThreads";

export default function Home() {
  const { threads, active, activeId, setActiveId, newChat, send } = useThreads();
  const [learnOn, setLearnOn] = useState(false);

  const busy = active.turns.some((t) => t.status === "thinking" || t.status === "revealing");
  const simulated = threads.some((t) => t.turns.some((x) => x.simulated));

  return (
    <div className="flex h-full">
      <Sidebar threads={threads} activeId={activeId} onSelect={setActiveId} onNew={newChat} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar learnOn={learnOn} onToggleLearn={() => setLearnOn((v) => !v)} dueCount={0} simulated={simulated} />
        <main className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {active.items.length === 0 ? (
                <EmptyState />
              ) : (
                <ThreadView thread={active} />
              )}
            </div>
            <Composer onSend={send} disabled={busy} />
          </section>
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-semibold">What should Claude work on in acme-notes?</h1>
      <p className="text-sm text-muted">Click the input to see suggested tasks.</p>
    </div>
  );
}

"use client";
import { FastForward, RotateCcw, Repeat2, X } from "lucide-react";
import { advanceClock, DAY, dueRefreshers, now, snoozeRefresher, type Refresher } from "@/lib/memory/model";
import { updateMemory, useMemory } from "@/lib/memory/store";

/** Spaced-repetition inbox (SPEC J3, §10.2–10.3) with the simulated clock control. */
export function InboxView({ onOpen, threadExists }: { onOpen: (r: Refresher) => void; threadExists: (id: string) => boolean }) {
  const m = useMemory();
  const due = dueRefreshers(m);
  const upcoming = Object.entries(m.mastery)
    .filter(([, r]) => r.nextDue != null && r.nextDue > now(m) && r.estimate < 0.7)
    .sort((a, b) => a[1].nextDue! - b[1].nextDue!);
  const offsetDays = Math.round(m.timeOffsetMs / DAY);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-note/40 bg-note-soft px-3.5 py-3 text-[12.5px] text-note">
        <div className="flex items-center gap-2">
          <span className="font-medium">Prototype clock</span>
          <span className="text-note/80">{offsetDays === 0 ? "real time" : `+${offsetDays} day${offsetDays === 1 ? "" : "s"}`}</span>
          <span className="ml-auto flex gap-1.5">
            <button onClick={() => updateMemory((x) => advanceClock(x, 3))} className="flex items-center gap-1 rounded-md border border-note/40 px-2 py-0.5 hover:bg-note/10">
              <FastForward size={12} /> +3 days
            </button>
            {offsetDays > 0 && (
              <button onClick={() => updateMemory((x) => ({ ...x, timeOffsetMs: 0 }))} className="flex items-center gap-1 rounded-md border border-note/40 px-2 py-0.5 hover:bg-note/10" title="Back to real time">
                <RotateCcw size={12} />
              </button>
            )}
          </span>
        </div>
        <p className="mt-1 text-note/80">Skip ahead to see spaced repetition bring topics back. Reviews are scheduled 1, 3, 7, 16, 35 days out.</p>
      </div>

      <section>
        <h3 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-muted">Due for a refresher</h3>
        {due.length === 0 ? (
          <p className="px-1 text-[13px] text-muted">Nothing due. Topics come back here when their review date passes and mastery is still below 70%.</p>
        ) : (
          <ul className="space-y-2">
            {due.map((r) => {
              const available = !!r.source && threadExists(r.source.threadId);
              const open = () => available && onOpen(r);
              return (
                <li key={r.topicId} className="relative">
                  {/* The whole card starts the refresher; the ✕ is a separate button that doesn't. */}
                  <div
                    role="button"
                    tabIndex={available ? 0 : -1}
                    aria-disabled={!available}
                    aria-label={`Start refresher: ${r.label}`}
                    title={available ? "Start refresher" : "The original chat isn't in this browser anymore"}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open();
                      }
                    }}
                    className={`rounded-xl border border-learn/30 bg-surface py-3 pr-10 pl-3.5 transition ${available ? "cursor-pointer hover:border-learn/60 hover:bg-learn/5" : "opacity-50"}`}
                  >
                    <div className="flex items-center gap-2 text-[14px] font-medium">
                      <Repeat2 size={14} className="shrink-0 text-learn" /> {r.label}
                      <span className="ml-auto font-mono text-[12px] font-normal text-muted">{Math.round(r.estimate * 100)}%</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      Last practised {r.daysSince}d ago{r.source?.threadTitle ? ` · from “${r.source.threadTitle}”` : ""} · ~1 min
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMemory((x) => snoozeRefresher(x, r.topicId));
                    }}
                    aria-label={`Dismiss refresher: ${r.label}`}
                    title="Not now (back tomorrow)"
                    className="absolute top-2 right-2 rounded-full p-1 text-muted hover:bg-learn/10 hover:text-text"
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-muted">Coming up</h3>
          <ul className="space-y-1 px-1 text-[13px]">
            {upcoming.map(([id, r]) => (
              <li key={id} className="flex text-muted">
                <span className="text-text/85">{m.topics[id]?.label ?? id}</span>
                <span className="ml-auto">in {Math.max(1, Math.round((r.nextDue! - now(m)) / DAY))}d</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

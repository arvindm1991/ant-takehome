"use client";
import { Bell, GraduationCap } from "lucide-react";

type Props = {
  learnOn: boolean;
  onToggleLearn: () => void;
  dueCount: number;
  simulated: boolean;
};

/** Floating top-right controls: the persistent Learn-mode toggle + refresher badge (SPEC §6). */
export function TopBar({ learnOn, onToggleLearn, dueCount, simulated }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-bg from-60% to-transparent px-5 pt-3 pb-5">
      <span className="pointer-events-auto flex items-center gap-2">
        <span className="rounded-full border border-note/40 px-2 py-0.5 text-[11px] font-medium tracking-wide text-note">
          PROTOTYPE
        </span>
        {simulated && <span className="text-[11px] text-muted">mock mode: no API key</span>}
      </span>
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          onClick={onToggleLearn}
          role="switch"
          aria-checked={learnOn}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13.5px] transition ${
            learnOn ? "border-learn/50 bg-learn-soft text-learn" : "border-border bg-surface text-text/90 hover:border-muted"
          }`}
        >
          <GraduationCap size={16} strokeWidth={1.75} />
          Learn mode
          <span className={`relative h-4 w-7 rounded-full transition ${learnOn ? "bg-learn" : "bg-raised"}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${learnOn ? "left-3.5" : "left-0.5"}`} />
          </span>
        </button>
        <button
          aria-label={`${dueCount} learning refreshers due`}
          className="relative rounded-full border border-border bg-surface p-2 text-text/90 hover:border-muted"
        >
          <Bell size={15} strokeWidth={1.75} />
          {dueCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">
              {dueCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

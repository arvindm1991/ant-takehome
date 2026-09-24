"use client";
import { Bell, GraduationCap, Menu } from "lucide-react";
import type { DeployStatus } from "@/lib/status";
import { ModeBadge } from "./ModeBadge";

type Props = {
  learnOn: boolean;
  onToggleLearn: () => void;
  dueCount: number;
  status: DeployStatus | null;
  onBell: () => void;
  /** Opens the chats drawer on narrow screens. */
  onMenu: () => void;
};

/** Floating top-right controls: the persistent Learn-mode toggle + refresher badge (SPEC §6). */
export function TopBar({ learnOn, onToggleLearn, dueCount, status, onBell, onMenu }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-bg from-60% to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-5 sm:px-5">
      <span className="pointer-events-auto flex min-w-0 items-center gap-1 overflow-hidden">
        <button onClick={onMenu} aria-label="Open chats" className="rounded-lg p-1.5 text-text/85 hover:bg-raised xl:hidden">
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <ModeBadge status={status} />
      </span>
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        <button
          onClick={onToggleLearn}
          role="switch"
          aria-checked={learnOn}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13.5px] transition ${
            learnOn ? "border-learn/50 bg-learn-soft text-learn" : "border-border bg-surface text-text/90 hover:border-muted"
          }`}
        >
          <GraduationCap size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Learn mode</span>
          <span className="sm:hidden">Learn</span>
          <span className={`relative h-4 w-7 rounded-full transition ${learnOn ? "bg-learn" : "bg-raised"}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${learnOn ? "left-3.5" : "left-0.5"}`} />
          </span>
        </button>
        <button
          onClick={onBell}
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

"use client";
import { GraduationCap, Repeat2, X } from "lucide-react";
import type { Topic } from "@/lib/learn/types";

/** Inline discovery chips (SPEC §11). Level-up framing, never remedial. */
export function LiveLearnChip({ topics, onClick }: { topics: Topic[]; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="appear ml-auto flex max-w-[85%] items-center gap-2 rounded-full border border-learn/40 bg-learn-soft px-3.5 py-1.5 text-[13.5px] text-learn hover:bg-learn/20"
    >
      <GraduationCap size={15} />
      <span>
        Learn while Claude builds this
        {topics.length > 0 && <span className="text-learn/75"> · {topics.map((t) => t.label).join(", ")}</span>}
      </span>
    </button>
  );
}

export function PostTaskLearnChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="appear flex w-full items-center gap-3 rounded-xl border border-learn/40 bg-learn-soft px-4 py-3 text-left text-learn hover:bg-learn/20"
    >
      <GraduationCap size={18} />
      <span className="text-[14px]">
        <span className="font-medium">Claude built this. Want to understand it before you review it?</span>
        <span className="text-learn/75"> About 3 minutes.</span>
      </span>
    </button>
  );
}

/** Contextual refresher (SPEC §10.3): direct recurrence or interleaving. One nudge per task, dismissible. */
export function RefresherChip({
  label,
  daysSince,
  interleave,
  onAccept,
  onDismiss,
}: {
  label: string;
  daysSince: number;
  interleave: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="appear ml-auto flex max-w-[85%] items-center gap-1 rounded-full border border-learn/40 bg-learn-soft pl-3.5 pr-1.5 text-[13.5px] text-learn">
      <button onClick={onAccept} className="flex items-center gap-2 py-1.5 text-left hover:underline">
        <Repeat2 size={15} />
        <span>
          {interleave ? `This builds on ${label}` : `You practised ${label}`}
          <span className="text-learn/75">
            {daysSince > 0 ? ` ${daysSince}d ago` : ""} · {interleave ? "one question connecting them?" : "quick refresher while Claude works?"}
          </span>
        </span>
      </button>
      <button onClick={onDismiss} aria-label="Dismiss" className="rounded-full p-1 text-learn/70 hover:bg-learn/15">
        <X size={13} />
      </button>
    </div>
  );
}

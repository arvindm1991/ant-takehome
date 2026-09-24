"use client";
import { ArrowDown } from "lucide-react";

/** Shown while a scroll area has stopped following new content because the reader scrolled up. */
export function JumpToLatest({ onClick, tone = "claude" }: { onClick: () => void; tone?: "claude" | "learn" }) {
  return (
    <div className="pointer-events-none sticky bottom-3 z-10 flex justify-center">
      <button
        onClick={onClick}
        className={`pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] shadow-lg ${
          tone === "learn" ? "border-learn/50 bg-lsa-surface text-learn" : "border-border bg-surface text-text/90"
        }`}
      >
        <ArrowDown size={13} /> Jump to latest
      </button>
    </div>
  );
}

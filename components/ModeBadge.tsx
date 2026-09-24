"use client";
import { useState } from "react";
import type { DeployStatus } from "@/lib/status";

/**
 * Shown only when the app is running its scripted fallback (no API key, or the API credits
 * ran out). With a working key there's no badge at all.
 */
export function ModeBadge({ status }: { status: DeployStatus | null }) {
  const [open, setOpen] = useState(false);
  const mock = !!status && (!status.mainAgent.live || !status.learningAgent.live);
  if (!mock) return null;

  return (
    <span className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full border border-note/40 px-2 py-0.5 text-[11.5px] font-medium text-note">
        <span className="h-1.5 w-1.5 rounded-full bg-note" /> Mock
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(400px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-4 text-[13px] leading-relaxed shadow-2xl">
          <div className="mb-1 font-medium">Scripted fallback</div>
          <p className="text-muted">
            This deployment isn&apos;t calling the Claude API right now (no API key, or the credits ran out), so Claude and Learn mode are running scripted
            responses. The login-page task and the quick question are covered; other prompts get a placeholder.
          </p>
          <button onClick={() => setOpen(false)} className="mt-3 text-[12px] text-muted hover:text-text">
            Close
          </button>
        </div>
      )}
    </span>
  );
}

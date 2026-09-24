"use client";
import { useState } from "react";
import type { DeployStatus } from "@/lib/status";

/** Header badge + popover: what's live from the Claude API vs simulated in this prototype. */
export function ModeBadge({ status }: { status: DeployStatus | null }) {
  const [open, setOpen] = useState(false);
  const live = !!status?.mainAgent.live && !!status?.learningAgent.live;
  const partial = !!status && !live && (status.mainAgent.live || status.learningAgent.live);

  return (
    <span className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-2">
        <span className="rounded-full border border-note/40 px-2 py-0.5 text-[11px] font-medium tracking-wide text-note">PROTOTYPE</span>
        {status && (
          <span className={`flex items-center gap-1.5 text-[12px] ${live ? "text-emerald-300/90" : "text-muted"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : partial ? "bg-note" : "bg-muted"}`} />
            <span className="hidden min-[360px]:inline sm:hidden">{live ? "Live" : partial ? "Partly live" : "Mock"}</span>
            <span className="hidden sm:inline">{live ? "Live · Claude API" : partial ? "Partly live" : "Mock · scripted responses"}</span>
          </span>
        )}
      </button>
      {open && status && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(440px,calc(100vw-24px))] max-h-[75dvh] overflow-y-auto rounded-xl border border-border bg-surface p-4 text-[13px] leading-relaxed shadow-2xl">
          <div className="mb-2 font-medium">What&apos;s real in this prototype</div>
          <Row label="Main agent" value={status.mainAgent.live ? `Live · ${status.mainAgent.model} (reasoning streamed)` : "Scripted mock (no API key)"} live={status.mainAgent.live} />
          <Row label="Learning agent" value={status.learningAgent.live ? `Live · ${status.learningAgent.model}` : "Scripted mock (no API key)"} live={status.learningAgent.live} />
          <Row label="Grader" value={status.learningAgent.live ? `Live · ${status.grader.model}` : "Scripted mock (keyword match)"} live={status.learningAgent.live} />
          <Row label="Widget builder" value={status.learningAgent.live ? `Live · ${status.widgetBuilder.model} (generated per session)` : "Pre-built demo widgets"} live={status.learningAgent.live} />
          <Row label="Learnability check" value={status.learningAgent.live ? `Live · ${status.classifier.model}` : "Scripted mock (regex)"} live={status.learningAgent.live} />
          <div className="mt-3 mb-1 font-medium">Always simulated</div>
          <ul className="list-disc space-y-0.5 pl-5 text-muted">
            <li>Step pacing: the full response is revealed step by step to mimic a long agent run</li>
            <li>The repository: a small fixture given to the agent as context; no files are written</li>
            <li>Learner memory lives in this browser (localStorage), not a server</li>
          </ul>
          <button onClick={() => setOpen(false)} className="mt-3 text-[12px] text-muted hover:text-text">
            Close
          </button>
        </div>
      )}
    </span>
  );
}

function Row({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <div className="flex gap-3 py-0.5">
      <span className="w-28 shrink-0 text-muted sm:w-32">{label}</span>
      <span className={live ? "text-emerald-300/90" : "text-note"}>{value}</span>
    </div>
  );
}

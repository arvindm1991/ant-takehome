"use client";
import { useState } from "react";
import type { DeployStatus } from "@/lib/status";

/**
 * Header chips: an always-present PROTOTYPE chip (what's simulated), plus a Mock badge only
 * when the app is running its scripted fallback (no API key, or the API credits ran out).
 */
export function ModeBadge({ status }: { status: DeployStatus | null }) {
  const [open, setOpen] = useState(false);
  const mock = !!status && (!status.mainAgent.live || !status.learningAgent.live);

  return (
    <span className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-2" aria-expanded={open}>
        <span className="rounded-full border border-note/40 px-2 py-0.5 text-[11px] font-medium tracking-wide text-note">PROTOTYPE</span>
        {mock && (
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-note" /> <span className="hidden min-[360px]:inline">Mock</span>
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-14 z-30 rounded-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[420px] border border-border bg-surface p-4 text-[13px] leading-relaxed shadow-2xl">
          <div className="mb-1 font-medium">About this prototype</div>
          <ul className="list-disc space-y-0.5 pl-5 text-muted">
            <li>The repository is a small fixture given to Claude as context; no files are written.</li>
            <li>Claude&apos;s steps are revealed at a simulated agent pace; no tools actually run.</li>
            <li>Learner memory lives in this browser, and the Inbox has a “+3 days” clock for trying spaced review.</li>
          </ul>
          {mock && (
            <p className="mt-2 text-note">
              Mock mode: the Claude API isn&apos;t being called right now (no API key, or the credits ran out), so responses are scripted. The login-page task and the
              quick question are covered.
            </p>
          )}
          <button onClick={() => setOpen(false)} className="mt-3 text-[12px] text-muted hover:text-text">
            Close
          </button>
        </div>
      )}
    </span>
  );
}

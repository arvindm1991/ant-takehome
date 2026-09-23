"use client";
import { useState } from "react";
import { ACME_NOTES, REPO_NAME } from "@/lib/repo/acmeNotes";
import type { Thread } from "@/lib/thread/types";
import { PrototypeNote } from "./PrototypeNote";

type Props = {
  threads: Thread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export function Sidebar({ threads, activeId, onSelect, onNew }: Props) {
  const [openFile, setOpenFile] = useState<string | null>(null);
  const file = ACME_NOTES.find((f) => f.path === openFile);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm font-medium hover:border-muted"
        >
          + New chat
        </button>
      </div>

      <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Chats &amp; tasks</div>
      <nav className="max-h-[35%] overflow-y-auto px-2">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
              t.id === activeId ? "bg-surface font-medium shadow-sm" : "text-text/80 hover:bg-surface/60"
            }`}
          >
            {t.title}
          </button>
        ))}
      </nav>

      <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-border px-3 pt-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Repository · {REPO_NAME}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
          {ACME_NOTES.map((f) => (
            <li key={f.path}>
              <button
                onClick={() => setOpenFile(openFile === f.path ? null : f.path)}
                className={`w-full truncate rounded px-1.5 py-1 text-left hover:bg-surface ${
                  openFile === f.path ? "bg-surface" : ""
                }`}
              >
                {f.path}
              </button>
            </li>
          ))}
        </ul>
        {file && (
          <pre className="mb-2 max-h-48 overflow-auto rounded border border-border bg-surface p-2 font-mono text-[10.5px] leading-snug">
            {file.content}
          </pre>
        )}
        <div className="pb-3">
          <PrototypeNote>this is a simulated repository given to the agent as context.</PrototypeNote>
        </div>
      </div>
    </aside>
  );
}

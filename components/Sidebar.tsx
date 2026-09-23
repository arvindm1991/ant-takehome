"use client";
import { ChevronDown, Clock, FolderKanban, Plus, Search, Shapes, SlidersHorizontal, Wrench } from "lucide-react";
import type { Thread } from "@/lib/thread/types";

type Props = {
  threads: Thread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
};

// Static entries so the list reads like a real, lived-in account.
const PAST_CHATS = ["Interactive atom learning tool", "Explaining a complex topic simply", "Chrome extension for audio transcription"];

const NAV = [
  { icon: FolderKanban, label: "Projects" },
  { icon: Shapes, label: "Artifacts" },
  { icon: Clock, label: "Scheduled" },
  { icon: Wrench, label: "Customize" },
  { icon: ChevronDown, label: "More", muted: true },
];

export function Sidebar({ threads, activeId, onSelect, onNew }: Props) {
  const started = threads.filter((t) => t.items.length > 0);

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-border bg-sidebar">
      <nav className="flex flex-col gap-0.5 px-2 pt-4">
        <button
          onClick={onNew}
          className="flex items-center gap-3 rounded-lg bg-raised px-3 py-2 text-left text-[15px] text-text hover:bg-raised/80"
        >
          <Plus size={17} strokeWidth={1.75} /> New
        </button>
        {NAV.map(({ icon: Icon, label, muted }) => (
          <div
            key={label}
            className={`flex cursor-default items-center gap-3 rounded-lg px-3 py-1.5 text-[15px] ${muted ? "text-muted" : "text-text/90"}`}
          >
            <Icon size={17} strokeWidth={1.75} /> {label}
          </div>
        ))}
      </nav>

      <div className="mt-6 flex items-center justify-between px-5 pb-2 text-[13.5px] text-muted">
        <span>Chats and tasks</span>
        <span className="flex gap-3">
          <Search size={15} />
          <SlidersHorizontal size={15} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {started.map((t) => (
          <ChatRow key={t.id} label={t.title} active={t.id === activeId} onClick={() => onSelect(t.id)} />
        ))}
        {PAST_CHATS.map((label) => (
          <ChatRow key={label} label={label} dim />
        ))}
      </div>

      <div className="flex items-center gap-2.5 border-t border-border px-4 py-3 text-[15px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-raised text-[11px] font-medium">AM</span>
        <span>Arvind</span>
        <span className="text-[13px] text-muted">· Pro</span>
      </div>
    </aside>
  );
}

function ChatRow({ label, active, dim, onClick }: { label: string; active?: boolean; dim?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[15px] ${
        active ? "bg-raised text-text" : dim ? "cursor-default text-text/60" : "text-text/90 hover:bg-raised/60"
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-muted" />
      <span className="truncate">{label}</span>
    </button>
  );
}

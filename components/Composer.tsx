"use client";
import { useState } from "react";
import { ArrowUp, Code2, Database, Folder, Gauge, Globe, KeyRound, Mic, Plus, Search } from "lucide-react";
import { ACME_NOTES, REPO_NAME } from "@/lib/repo/acmeNotes";

// SPEC §12. Only #1 is tuned end to end (D17).
export const SUGGESTED_TASKS = [
  { text: "Build a login page with JWT auth for this app", icon: KeyRound, tag: "Primary demo" },
  { text: "Write a SQL query for monthly user retention cohorts", icon: Database },
  { text: "Add rate limiting to the login endpoint", icon: Gauge },
  { text: "Implement a debounced search box for notes in React", icon: Search },
  { text: "What's the capital of France?", icon: Globe, tag: "Quick question" },
];

type Props = { onSend: (text: string) => void; disabled: boolean; variant: "hero" | "docked" };

export function Composer({ onSend, disabled, variant }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [showRepo, setShowRepo] = useState(false);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setText("");
    setFocused(false);
  };

  const showSuggestions = variant === "docked" && focused && !text && !disabled;

  return (
    <div className="relative w-full">
      {showSuggestions && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <SuggestionList onPick={submit} compact />
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="rounded-[20px] border border-border bg-surface px-4 pt-3.5 pb-3 shadow-sm focus-within:border-muted/60"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onClick={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(text);
            }
          }}
          rows={variant === "hero" ? 2 : 1}
          placeholder={disabled ? "Claude is working…" : variant === "hero" ? "How can I help you today?" : "Reply to Claude…"}
          className="w-full resize-none bg-transparent px-1 text-[16px] outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-text/80">
            <Plus size={18} strokeWidth={1.75} />
          </span>
          <span className="flex rounded-lg bg-bg/60 p-0.5 text-[14px]">
            <span className="rounded-md px-3 py-1 text-muted">Chat</span>
            <span className="rounded-md bg-raised px-3 py-1 text-text">Cowork</span>
          </span>
          <span className="ml-auto text-[14px] text-text/90">
            Opus 5 <span className="text-muted">Medium</span>
          </span>
          <Mic size={17} strokeWidth={1.75} className="mx-1 text-text/80" />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            aria-label="Send"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-35"
          >
            <ArrowUp size={17} strokeWidth={2.25} />
          </button>
        </div>
      </form>

      <div className="relative mt-2 flex items-center gap-5 px-5 text-[14px] text-text/80">
        <button type="button" onClick={() => setShowRepo((v) => !v)} className="flex items-center gap-1.5 hover:text-text">
          <Folder size={14} strokeWidth={1.75} /> {REPO_NAME}
        </button>
        <span className="text-muted">Manual</span>
        <span className="text-muted">Output</span>
        {showRepo && <RepoPopover onClose={() => setShowRepo(false)} />}
      </div>
    </div>
  );
}

export function SuggestionList({ onPick, compact }: { onPick: (t: string) => void; compact?: boolean }) {
  return (
    <div className={compact ? "py-1.5" : ""}>
      <div className={`px-4 pb-2 text-[14px] text-muted ${compact ? "pt-2" : ""}`}>{compact ? "Suggested tasks" : "Ideas for you"}</div>
      {SUGGESTED_TASKS.map(({ text, icon: Icon, tag }) => (
        <button
          key={text}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(text);
          }}
          className={`flex w-full items-center gap-4 rounded-xl px-4 text-left text-[15.5px] hover:bg-raised/60 ${compact ? "py-2" : "py-3"}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg/50 text-text/70">
            <Icon size={17} strokeWidth={1.5} />
          </span>
          <span>{text}</span>
          {tag && <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">{tag}</span>}
        </button>
      ))}
    </div>
  );
}

function RepoPopover({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const file = ACME_NOTES.find((f) => f.path === open);
  return (
    <div className="absolute left-3 top-full z-20 mt-2 w-[420px] rounded-xl border border-border bg-surface p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-1.5 font-medium">
          <Code2 size={14} /> {REPO_NAME}
        </span>
        <button onClick={onClose} className="text-muted hover:text-text">
          Close
        </button>
      </div>
      <ul className="max-h-48 overflow-y-auto font-mono text-[12px]">
        {ACME_NOTES.map((f) => (
          <li key={f.path}>
            <button
              onClick={() => setOpen(open === f.path ? null : f.path)}
              className={`w-full rounded px-2 py-1 text-left hover:bg-raised ${open === f.path ? "bg-raised" : ""}`}
            >
              {f.path}
            </button>
          </li>
        ))}
      </ul>
      {file && (
        <pre className="mt-2 max-h-52 overflow-auto rounded-lg border border-border bg-code p-2 font-mono text-[11px] leading-snug">
          {file.content}
        </pre>
      )}
      <p className="mt-2 text-[11.5px] text-note">ⓘ Prototype note: a simulated repository, given to the agent as context.</p>
    </div>
  );
}

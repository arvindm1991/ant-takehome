"use client";
import { useState } from "react";

// SPEC §12. Only #1 is tuned end to end (D17).
export const SUGGESTED_TASKS = [
  { text: "Build a login page with JWT auth for this app", tag: "Primary demo" },
  { text: "Write a SQL query for monthly user retention cohorts" },
  { text: "Add rate limiting to the login endpoint" },
  { text: "Implement a debounced search box for notes in React" },
  { text: "What's the capital of France?", tag: "Quick question" },
];

export function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setText("");
    setFocused(false);
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl px-6 pb-5">
      {focused && !text && !disabled && (
        <div className="absolute bottom-full left-6 right-6 mb-2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Suggested tasks</div>
          {SUGGESTED_TASKS.map((s) => (
            <button
              key={s.text}
              onMouseDown={(e) => {
                e.preventDefault();
                submit(s.text);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-bg"
            >
              <span>{s.text}</span>
              {s.tag && (
                <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">{s.tag}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm focus-within:border-muted"
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
          rows={2}
          placeholder={disabled ? "Claude is working…" : "Ask Claude to do something in acme-notes…"}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="Send"
          className="h-9 w-9 rounded-full bg-accent text-white disabled:opacity-40"
        >
          ↑
        </button>
      </form>
    </div>
  );
}

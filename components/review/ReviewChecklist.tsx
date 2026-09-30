"use client";
import { useState } from "react";
import { Check, ListChecks, MessageSquare, MessageSquareText, Minus, Paperclip, X } from "lucide-react";
import type { Checklist } from "@/lib/review/types";
import type { ParsedReview } from "@/lib/review/format";

type Props = {
  list: Checklist;
  onToggle: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onMinimize: () => void;
  onClose: () => void;
  onAttach: () => void;
  onRetry: () => void;
  onLook: (path: string) => void;
};

/** "What good looks like" for the finished task, filled in by the user, never pre-checked. */
export function ReviewChecklist({ list, onToggle, onComment, onMinimize, onClose, onAttach, onRetry, onLook }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const done = list.items.filter((i) => i.checked).length;
  return (
    <section
      role="dialog"
      aria-label="Review checklist"
      className="appear flex max-h-[min(68dvh,560px)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:w-[440px]"
    >
      <header className="flex items-start gap-2.5 border-b border-border px-4 py-3">
        <ListChecks size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium">Review Claude&apos;s work</h2>
          <p className="text-[13px] text-muted">What good looks like for this task. Check each one against the work yourself.</p>
        </div>
        <button aria-label="Minimize review checklist" onClick={onMinimize} className="rounded-md p-1 text-muted hover:bg-raised hover:text-text">
          <Minus size={16} />
        </button>
        <button aria-label="Close review checklist" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-raised hover:text-text">
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {list.status === "loading" && (
          <div className="flex flex-col gap-2 px-2 py-1">
            <div className="shimmer text-sm font-medium">Writing a checklist for this task…</div>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="h-5 animate-pulse rounded bg-raised/70" style={{ width: `${88 - n * 9}%` }} />
            ))}
          </div>
        )}
        {list.status === "error" && (
          <div className="flex items-center gap-3 px-2 py-2 text-sm text-muted">
            Couldn&apos;t write a checklist.
            <button onClick={onRetry} className="rounded-md border border-border px-2 py-0.5 text-text hover:bg-raised">
              Try again
            </button>
          </div>
        )}
        {list.status === "ready" && (
          <ul className="flex flex-col">
            {list.items.map((i) => (
              <li key={i.id} className="rounded-lg px-2 py-1.5 hover:bg-raised/40">
                <div className="flex items-start gap-2.5">
                  <button
                    role="checkbox"
                    aria-checked={i.checked}
                    aria-label={i.text}
                    onClick={() => onToggle(i.id)}
                    className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border ${i.checked ? "border-accent bg-accent text-white" : "border-muted/60 hover:border-text"}`}
                  >
                    {i.checked && <Check size={13} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onToggle(i.id)} className={`text-left text-[14.5px] leading-snug ${i.checked ? "text-muted" : ""}`}>
                      {i.text}
                    </button>
                    {i.lookAt && (
                      <button onClick={() => onLook(i.lookAt)} className="mt-0.5 block font-mono text-[12px] text-muted underline decoration-dotted underline-offset-2 hover:text-text">
                        {i.lookAt}
                      </button>
                    )}
                    {i.comment && editing !== i.id && (
                      <button onClick={() => setEditing(i.id)} className="mt-1 block w-full rounded-md bg-raised/60 px-2 py-1 text-left text-[13px] text-text/90">
                        {i.comment}
                      </button>
                    )}
                    {editing === i.id && (
                      <textarea
                        autoFocus
                        rows={2}
                        value={i.comment}
                        onChange={(e) => onComment(i.id, e.target.value)}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            setEditing(null);
                          }
                        }}
                        aria-label={`Comment on: ${i.text}`}
                        placeholder="Add a comment for Claude…"
                        className="mt-1 w-full resize-none rounded-md border border-border bg-bg px-2 py-1 text-[13.5px] outline-none focus:border-muted/60"
                      />
                    )}
                  </div>
                  <button
                    aria-label={`${i.comment ? "Edit comment" : "Comment"} on: ${i.text}`}
                    onClick={() => setEditing(editing === i.id ? null : i.id)}
                    className={`mt-0.5 shrink-0 rounded-md p-1 hover:bg-raised ${i.comment ? "text-accent" : "text-muted hover:text-text"}`}
                  >
                    {i.comment ? <MessageSquareText size={15} /> : <MessageSquare size={15} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {list.status === "ready" && (
        <footer className="flex items-center gap-3 border-t border-border px-4 py-2.5">
          <span className="text-[13px] text-muted">
            {done} of {list.items.length} checked
          </span>
          <button onClick={onAttach} className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13.5px] font-medium text-white hover:opacity-90">
            <Paperclip size={14} /> Attach to reply
          </button>
        </footer>
      )}
    </section>
  );
}

/** The minimized checklist: a small pill above the composer. */
export function ReviewPill({ list, onOpen }: { list: Checklist; onOpen: () => void }) {
  const done = list.items.filter((i) => i.checked).length;
  return (
    <button onClick={onOpen} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] shadow-sm hover:bg-raised">
      <ListChecks size={14} className="text-accent" /> Review checklist
      {list.status === "ready" && <span className="text-muted">· {done}/{list.items.length}</span>}
    </button>
  );
}

/** Under a finished task once the checklist is closed, so it can be reopened. */
export function ReviewReopen({ list, onOpen }: { list: Checklist; onOpen: () => void }) {
  const done = list.items.filter((i) => i.checked).length;
  return (
    <button onClick={onOpen} className="flex w-fit items-center gap-1.5 px-1 text-[13px] text-muted hover:text-text">
      <ListChecks size={14} /> {list.sent ? "Review checklist sent" : "Review checklist"}
      {list.status === "ready" && <span>· {done}/{list.items.length}</span>}
    </button>
  );
}

/** The checklist inside the user's sent message. */
export function SentReview({ review }: { review: ParsedReview }) {
  return (
    <div className="mt-2 rounded-xl border border-border bg-surface/70 px-3 py-2 text-[13.5px]">
      <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
        <ListChecks size={13} /> Review checklist · {review.done} of {review.total} checked
      </div>
      <ul className="flex flex-col gap-1">
        {review.items.map((i, n) => (
          <li key={n} className="flex gap-2">
            <span className={`mt-0.5 flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-sm border ${i.checked ? "border-accent bg-accent text-white" : "border-muted/60"}`}>
              {i.checked && <Check size={10} strokeWidth={3} />}
            </span>
            <span>
              <span className={i.checked ? "text-muted" : ""}>{i.text}</span>
              {i.comment && <span className="block text-text/80">“{i.comment}”</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

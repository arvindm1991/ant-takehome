"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AssistantTurn, Thread, ThreadItem } from "@/lib/thread/types";
import { PrototypeNote } from "./PrototypeNote";

export type ThreadSlots = {
  /** Rendered under a user prompt (e.g. the learn-mode chip). */
  afterPrompt?: (messageId: string) => React.ReactNode;
  /** Rendered after a finished assistant turn. */
  afterTurn?: (messageId: string) => React.ReactNode;
};

export function ThreadView({ thread, slots }: { thread: Thread; slots?: ThreadSlots }) {
  const bottom = useRef<HTMLDivElement>(null);
  const revealedCount = thread.items.filter((i) => i.revealed).length;
  const lastReasoningLen = thread.items.findLast((i) => i.kind === "reasoning")?.content.length ?? 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [revealedCount, lastReasoningLen, thread.turns.length]);

  const prompts = thread.items.filter((i) => i.kind === "user_prompt");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      {prompts.map((p) => {
        const messageId = p.messageId.replace("u", "m");
        const turn = thread.turns.find((t) => t.messageId === messageId);
        const items = thread.items.filter((i) => i.messageId === messageId);
        return (
          <div key={p.id} className="flex flex-col gap-3">
            <Item item={p}>
              <div className="ml-auto max-w-[85%] rounded-2xl bg-raised px-4 py-2.5 text-[15.5px]">{p.content}</div>
            </Item>
            {slots?.afterPrompt?.(messageId)}
            {turn && <AssistantBlock turn={turn} items={items} />}
            {slots?.afterTurn?.(messageId)}
          </div>
        );
      })}
      <div ref={bottom} />
    </div>
  );
}

function AssistantBlock({ turn, items }: { turn: AssistantTurn; items: ThreadItem[] }) {
  const reasoning = items.find((i) => i.kind === "reasoning");
  const steps = items.filter((i) => i.kind !== "reasoning");
  const shown = steps.filter((s) => s.revealed);
  const next = steps.find((s) => !s.revealed);

  return (
    <div className="flex flex-col gap-2.5">
      {reasoning && <Reasoning item={reasoning} active={turn.status === "thinking"} />}
      {shown.map((s) => (
        <Item key={s.id} item={s}>
          <Step item={s} />
        </Item>
      ))}
      {turn.status === "revealing" && next && (
        <div className="shimmer px-1 text-sm font-medium">{workingLabel(next)}</div>
      )}
      {turn.status === "error" && (
        <div className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          Something went wrong: {turn.error}
        </div>
      )}
      {turn.complexity === "task" && turn.status !== "error" && (
        <PrototypeNote>
          steps are revealed at a simulated agent pace; the real agent loop (tool calls) is out of scope for this
          prototype.{turn.simulated ? " This response is scripted (mock mode, no API key configured)." : ""}
        </PrototypeNote>
      )}
    </div>
  );
}

function workingLabel(next: ThreadItem) {
  switch (next.kind) {
    case "read":
      return `Reading ${next.title}…`;
    case "plan":
      return "Planning…";
    case "file":
      return `Writing ${next.title}…`;
    case "command":
      return "Running command…";
    default:
      return "Wrapping up…";
  }
}

/** Wrapper that gives every thread item a stable DOM anchor (SPEC §7.2). */
function Item({ item, children }: { item: ThreadItem; children: React.ReactNode }) {
  return (
    <div id={`item-${item.id}`} data-item-id={item.id} className="group relative appear rounded-lg">
      {children}
      <span className="pointer-events-none absolute -left-2 top-1 hidden -translate-x-full font-mono text-[10px] text-muted/70 group-hover:block">
        {item.id.split(":")[1]}
      </span>
    </div>
  );
}

function Reasoning({ item, active }: { item: ThreadItem; active: boolean }) {
  // Open while streaming, collapsed once done, unless the user toggled it.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? active;
  if (!item.content && !active) return null;
  return (
    <Item item={item}>
      <div className="rounded-lg border border-border bg-surface">
        <button onClick={() => setUserOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
          <span className={active ? "shimmer font-medium" : "font-medium text-muted"}>
            {active ? "Thinking…" : "Thought process"}
          </span>
          <span className="ml-auto text-xs text-muted">{open ? "Hide" : "Show"}</span>
        </button>
        {open && (
          <div className="max-h-56 overflow-y-auto border-t border-border px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-muted">
            {item.content || "…"}
          </div>
        )}
      </div>
    </Item>
  );
}

function Step({ item }: { item: ThreadItem }) {
  switch (item.kind) {
    case "read":
      return (
        <div className="flex items-baseline gap-2 px-1 text-sm">
          <span className="text-muted">Read</span>
          <code className="rounded bg-code px-1.5 py-0.5 font-mono text-[12.5px]">{item.title}</code>
          <span className="truncate text-muted">{item.content}</span>
        </div>
      );
    case "plan":
    case "note":
    case "answer":
      return (
        <div className={item.kind === "answer" ? "prose-md px-1 font-serif text-[17px] leading-relaxed" : "rounded-lg border border-border bg-surface px-4 py-3"}>
          {item.kind !== "answer" && (
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{item.title}</div>
          )}
          <div className="prose-md text-[14.5px] leading-relaxed">
            <ReactMarkdown>{item.content}</ReactMarkdown>
          </div>
        </div>
      );
    case "file":
    case "command":
      return <CodeCard item={item} />;
    default:
      return null;
  }
}

function CodeCard({ item }: { item: ThreadItem }) {
  const [open, setOpen] = useState(item.kind === "command");
  const lines = item.content.split("\n").length;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <span className="text-muted">{item.kind === "command" ? "$" : "✎"}</span>
        <span className="font-mono text-[13px] font-medium">{item.title}</span>
        <span className="ml-auto text-xs text-muted">
          {item.kind === "file" ? `${lines} lines · ` : ""}
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-border bg-code px-4 py-3 font-mono text-[12.5px] leading-relaxed">
          {item.content}
        </pre>
      )}
    </div>
  );
}

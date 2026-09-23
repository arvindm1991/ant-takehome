"use client";
import { useCallback, useRef, useState } from "react";
import type { MainEvent, MainStep } from "@/lib/main/schema";
import type { MainHistoryMessage } from "@/lib/main/request";
import { revealDelayMs } from "./pacing";
import { itemId, shortId, type AssistantTurn, type Thread, type ThreadItem } from "./types";

const newThread = (): Thread => ({
  id: shortId("t"),
  title: "New chat",
  createdAt: Date.now(),
  items: [],
  turns: [],
});

export type UseThreadsOptions = {
  /** Generic hook for observers (e.g. learn mode); the main agent is unaware of them. */
  onPromptSent?: (threadId: string, messageId: string, prompt: string) => void;
};

export function useThreads(opts: UseThreadsOptions = {}) {
  const [threads, setThreads] = useState<Thread[]>(() => [newThread()]);
  const [activeId, setActiveId] = useState<string>(() => threads[0].id);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  const update = useCallback((threadId: string, fn: (t: Thread) => Thread) => {
    setThreads((ts) => ts.map((t) => (t.id === threadId ? fn(t) : t)));
  }, []);

  const patchTurn = useCallback(
    (threadId: string, messageId: string, patch: Partial<AssistantTurn>) =>
      update(threadId, (t) => ({
        ...t,
        turns: t.turns.map((x) => (x.messageId === messageId ? { ...x, ...patch } : x)),
      })),
    [update],
  );

  const newChat = useCallback(() => {
    const t = newThread();
    setThreads((ts) => [t, ...ts]);
    setActiveId(t.id);
  }, []);

  const send = useCallback(
    async (prompt: string) => {
      const thread = active;
      const threadId = thread.id;
      const n = thread.turns.length + 1;
      const userMsgId = `u${n}`;
      const messageId = `m${n}`;

      // History for the main agent: prior prompts + assistant summaries only.
      const history: MainHistoryMessage[] = thread.items
        .filter((i) => i.kind === "user_prompt")
        .flatMap((i) => {
          const turn = thread.turns.find((x) => x.messageId === i.messageId.replace("u", "m"));
          return [
            { role: "user" as const, content: i.content },
            { role: "assistant" as const, content: turn?.summary ?? "(no response)" },
          ];
        });

      const promptItem: ThreadItem = {
        id: itemId(threadId, userMsgId, 0),
        threadId,
        messageId: userMsgId,
        kind: "user_prompt",
        title: "Prompt",
        content: prompt,
        revealed: true,
        revealedAt: Date.now(),
      };
      const reasoningItem: ThreadItem = {
        id: itemId(threadId, messageId, 0),
        threadId,
        messageId,
        kind: "reasoning",
        title: "Thinking",
        content: "",
        revealed: true,
        revealedAt: Date.now(),
      };
      update(threadId, (t) => ({
        ...t,
        title: t.turns.length === 0 ? prompt.slice(0, 48) : t.title,
        items: [...t.items, promptItem, reasoningItem],
        turns: [...t.turns, { messageId, status: "thinking" }],
      }));

      opts.onPromptSent?.(threadId, messageId, prompt);

      const onEvent = (e: MainEvent) => {
        if (e.type === "thinking") {
          update(threadId, (t) => ({
            ...t,
            items: t.items.map((i) =>
              i.id === reasoningItem.id ? { ...i, content: i.content + e.text } : i,
            ),
          }));
        } else if (e.type === "error") {
          patchTurn(threadId, messageId, { status: "error", error: e.message });
        } else {
          const { result, simulated } = e;
          const trivial = result.complexity === "trivial";
          const steps: ThreadItem[] = result.steps.map((s: MainStep, idx) => ({
            id: itemId(threadId, messageId, idx + 1),
            threadId,
            messageId,
            kind: s.kind,
            title: s.title,
            content: s.content,
            lang: s.lang || undefined,
            revealed: trivial,
            revealedAt: trivial ? Date.now() : undefined,
          }));
          update(threadId, (t) => ({ ...t, items: [...t.items, ...steps] }));
          patchTurn(threadId, messageId, {
            status: trivial ? "done" : "revealing",
            complexity: result.complexity,
            summary: result.summary,
            simulated,
          });
          if (!trivial) scheduleReveal(threadId, messageId, steps, result.steps);
        }
      };

      try {
        const res = await fetch("/api/main", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, history }),
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (raw) onEvent(JSON.parse(raw) as MainEvent);
          }
        }
      } catch (err) {
        patchTurn(threadId, messageId, {
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, update, patchTurn, opts.onPromptSent],
  );

  function scheduleReveal(threadId: string, messageId: string, items: ThreadItem[], steps: MainStep[]) {
    let at = 0;
    items.forEach((item, idx) => {
      at += revealDelayMs(steps[idx]);
      timers.current.push(
        setTimeout(() => {
          update(threadId, (t) => ({
            ...t,
            items: t.items.map((i) => (i.id === item.id ? { ...i, revealed: true, revealedAt: Date.now() } : i)),
          }));
          if (idx === items.length - 1) patchTurn(threadId, messageId, { status: "done" });
        }, at),
      );
    });
  }

  return { threads, active, activeId, setActiveId, newChat, send };
}

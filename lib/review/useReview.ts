"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Checklist, ChecklistView, ReviewCriterion, ReviewRequest } from "./types";

const STORAGE_KEY = "learnMode.review.v1";
const key = (threadId: string, messageId: string) => `${threadId}:${messageId}`;

function load(): Record<string, Checklist> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Checklist>;
    // A checklist still loading when the page closed can't finish; let the user retry.
    return Object.fromEntries(Object.entries(raw).map(([k, c]) => [k, c.status === "loading" ? { ...c, status: "error" as const } : c]));
  } catch {
    return {};
  }
}

/** Review checklists for finished tasks, one per assistant turn that produced work. */
export function useReview() {
  // The app renders client-only (app/page.tsx), so storage can be read up front.
  const [lists, setLists] = useState<Record<string, Checklist>>(load);
  const inputs = useRef<Record<string, ReviewRequest>>({});

  useEffect(() => {
    try {
      const recent = Object.entries(lists).sort((a, b) => b[1].openedAt - a[1].openedAt).slice(0, 30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(recent)));
    } catch {
      /* storage unavailable: checklists live in memory only */
    }
  }, [lists]);

  const patch = useCallback((threadId: string, messageId: string, fn: (c: Checklist) => Checklist) => {
    setLists((all) => {
      const c = all[key(threadId, messageId)];
      return c ? { ...all, [key(threadId, messageId)]: fn(c) } : all;
    });
  }, []);

  const fetchItems = useCallback(
    async (threadId: string, messageId: string, input: ReviewRequest) => {
      try {
        const res = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        if (!res.ok) throw new Error(String(res.status));
        const { items } = (await res.json()) as { items: ReviewCriterion[] };
        patch(threadId, messageId, (c) => ({
          ...c,
          status: "ready",
          items: items.map((i, n) => ({ ...i, id: `r${n}`, checked: false, comment: "" })),
        }));
      } catch {
        patch(threadId, messageId, (c) => ({ ...c, status: "error" }));
      }
    },
    [patch],
  );

  const create = useCallback(
    (threadId: string, messageId: string, input: ReviewRequest) => {
      inputs.current[key(threadId, messageId)] = input;
      setLists((all) =>
        all[key(threadId, messageId)]
          ? all
          : { ...all, [key(threadId, messageId)]: { threadId, messageId, status: "loading", items: [], view: "open", attached: false, sent: false, openedAt: Date.now() } },
      );
      void fetchItems(threadId, messageId, input);
    },
    [fetchItems],
  );

  const retry = useCallback(
    (threadId: string, messageId: string, fallback: ReviewRequest) => {
      patch(threadId, messageId, (c) => ({ ...c, status: "loading" }));
      void fetchItems(threadId, messageId, inputs.current[key(threadId, messageId)] ?? fallback);
    },
    [fetchItems, patch],
  );

  const toggle = useCallback(
    (threadId: string, messageId: string, id: string) =>
      patch(threadId, messageId, (c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, checked: !i.checked, checkedAt: i.checked ? undefined : Date.now() } : i)) })),
    [patch],
  );
  const comment = useCallback(
    (threadId: string, messageId: string, id: string, text: string) =>
      patch(threadId, messageId, (c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, comment: text } : i)) })),
    [patch],
  );
  const setView = useCallback(
    (threadId: string, messageId: string, view: ChecklistView) =>
      patch(threadId, messageId, (c) => ({ ...c, view, openedAt: view === "open" && c.view !== "open" && !c.items.some((i) => i.checked) ? Date.now() : c.openedAt })),
    [patch],
  );
  const attach = useCallback(
    (threadId: string, messageId: string, attached: boolean) =>
      patch(threadId, messageId, (c) => ({ ...c, attached, view: attached ? "min" : c.view })),
    [patch],
  );
  const markSent = useCallback(
    (threadId: string, messageId: string) => patch(threadId, messageId, (c) => ({ ...c, attached: false, sent: true, view: "closed" })),
    [patch],
  );

  /** A new message moves on from earlier checklists in the thread; each stays reopenable under its task. */
  const closeIn = useCallback(
    (threadId: string) =>
      setLists((all) => Object.fromEntries(Object.entries(all).map(([k, c]) => [k, c.threadId === threadId && c.view !== "closed" ? { ...c, view: "closed" as const, attached: false } : c]))),
    [],
  );

  const get = useCallback((threadId: string, messageId: string): Checklist | undefined => lists[key(threadId, messageId)], [lists]);
  const attachedIn = useCallback((threadId: string) => Object.values(lists).find((c) => c.threadId === threadId && c.attached && !c.sent), [lists]);

  return { get, attachedIn, closeIn, create, retry, toggle, comment, setView, attach, markSent };
}

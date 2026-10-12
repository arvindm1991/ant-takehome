"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Composer, SuggestionList, SUGGESTED_TASKS } from "@/components/Composer";
import { mockResponse } from "@/lib/main/mock";
import { track } from "@/lib/analytics";
import { LearnPanel, LearnPeek, LearnRail } from "@/components/learn/LearnPanel";
import { ResizeHandle } from "@/components/ResizeHandle";
import { LiveLearnChip, PostTaskLearnChip, RefresherChip } from "@/components/learn/LearnChips";
import type { PanelTab } from "@/components/learn/LearnPanel";
import { Sidebar } from "@/components/Sidebar";
import { ThreadView, type ThreadSlots } from "@/components/ThreadView";
import { TopBar } from "@/components/TopBar";
import { useLearn } from "@/lib/learn/useLearn";
import { useThreads } from "@/lib/thread/useThreads";
import { useDeployStatus } from "@/lib/status";
import { useMemory } from "@/lib/memory/store";
import { dueRefreshers, estimateOf, normalizeTopicId, type Refresher } from "@/lib/memory/model";
import type { Learnability } from "@/lib/learn/types";
import { THREAD_FOCUS_EVENT } from "@/lib/thread/focus";
import { useMediaQuery, useWidePanel } from "@/lib/useMediaQuery";
import { useReview } from "@/lib/review/useReview";
import { composeReply } from "@/lib/review/format";
import type { ReviewRequest } from "@/lib/review/types";
import type { Thread } from "@/lib/thread/types";
import { focusThreadItem } from "@/lib/thread/focus";
import { ReviewChecklist, ReviewPill, ReviewReopen } from "@/components/review/ReviewChecklist";

const PANEL_DEFAULT = 440;
const PANEL_MIN = 360;
const PANEL_MAX = 960;

// Layout preferences are per-viewer conveniences; storage may be unavailable (private mode), so never throw.
function stored(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(`learnMode.ui.${key}`));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: number) {
  try {
    localStorage.setItem(`learnMode.ui.${key}`, String(value));
  } catch {}
}

export function App({ demo }: { demo?: "review" } = {}) {
  // The main thread only exposes a generic "prompt sent" observer; learn mode subscribes to it.
  const onPromptSent = useRef<(threadId: string, messageId: string, prompt: string) => void>(undefined);
  const { threads, active, activeId, setActiveId, newChat, send, replay } = useThreads({
    onPromptSent: (t, m, p) => onPromptSent.current?.(t, m, p),
  });
  const learn = useLearn(threads, activeId);
  const review = useReview();

  // Showcase: /demo (or /?demo=review) opens the login-page task near its end, so the review checklist
  // appears a few seconds later. On the home page the param is dropped so a reload doesn't replay it.
  const demoStarted = useRef(false);
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("demo") === "review";
    if (demoStarted.current || !(demo === "review" || fromLink)) return;
    demoStarted.current = true;
    if (fromLink) window.history.replaceState(null, "", window.location.pathname);
    track("demo_started", { demo: "review", via: demo ? "demo page" : "home link" });
    const prompt = SUGGESTED_TASKS[0].text;
    const { thinking, result } = mockResponse(prompt);
    replay(prompt, thinking.join(""), result, 3);
  }, [replay, demo]);
  const status = useDeployStatus();
  const memory = useMemory();
  // SPEC §11: suggest learning only if some topic isn't mastered yet.
  const worthSuggesting = (lb?: Learnability) =>
    !!lb?.learnable && (lb.topics.length === 0 || lb.topics.some((t) => (estimateOf(memory, normalizeTopicId(t.id)) ?? 0) < 0.7));
  useEffect(() => {
    onPromptSent.current = learn.onPromptSent;
  });

  const [tab, setTab] = useState<PanelTab>("session");
  // Phones and small tablets: chats live in a drawer, the learning agent in a bottom sheet that can shrink to a peek bar.
  const wide = useWidePanel();
  const [navOpen, setNavOpen] = useState(false);
  const [sheetFull, setSheetFull] = useState(true);
  // Wide screens: the Learn mode panel can be collapsed to a rail (Learn mode stays on) and resized; chats can be collapsed.
  const xl = useMediaQuery("(min-width: 1280px)");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => stored("sidebarCollapsed", 0) === 1);
  const [panelWidth, setPanelWidth] = useState(() => stored("learnPanelWidth", PANEL_DEFAULT));
  const openSheet = () => {
    setSheetFull(true);
    setPanelCollapsed(false);
  };
  useEffect(() => {
    // When the learning agent points at Claude's code, the sheet steps aside so the step is visible.
    const onFocus = () => setSheetFull(false);
    window.addEventListener(THREAD_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(THREAD_FOCUS_EVENT, onFocus);
  }, []);
  const dueCount = dueRefreshers(memory).length;
  // A live/post-task session already covers this message (refresher sessions don't).
  const learnedHere = (messageId: string) => session?.messageId === messageId && (session.trigger === "live" || session.trigger === "post_task");

  const openRefresher = (r: Refresher) => {
    if (!r.source) return;
    setActiveId(r.source.threadId);
    setTab("session");
    openSheet();
    learn.startRefresher(r.source.threadId, r.source.messageId, { id: r.topicId, label: r.label, daysSince: r.daysSince }, "refresher", null);
  };

  const busy = active.turns.some((t) => t.status === "thinking" || t.status === "revealing");
  const empty = active.items.length === 0;
  const session = learn.session;

  // Review checklist: when Claude finishes work that produced files, the user gets "what good looks like"
  // for that task to check themselves. It's written while the steps are still being revealed.
  const { create: createReview } = review;
  useEffect(() => {
    for (const t of threads)
      for (const turn of t.turns) {
        if (turn.status !== "revealing" || turn.complexity !== "task" || review.get(t.id, turn.messageId)) continue;
        const input = reviewInput(t, turn.messageId);
        if (input.files.length) createReview(t.id, turn.messageId, input);
      }
  }, [threads, review, createReview]);
  const lastTurn = active.turns.at(-1);
  const lastList = lastTurn?.status === "done" ? review.get(active.id, lastTurn.messageId) : undefined;
  const openList = lastList?.view === "open" ? lastList : active.turns.map((t) => review.get(active.id, t.messageId)).find((c) => c?.view === "open" && c.messageId !== lastTurn?.messageId);
  const attachedList = review.attachedIn(active.id);
  const [reviewInset, setReviewInset] = useState(0);
  const measureReview = useRef<ResizeObserver | null>(null);
  const reviewCardRef = useCallback((el: HTMLDivElement | null) => {
    measureReview.current?.disconnect();
    if (!el) return setReviewInset(0);
    measureReview.current = new ResizeObserver(() => setReviewInset(el.offsetHeight + 8));
    measureReview.current.observe(el);
  }, []);
  const sendTask = (text: string) => {
    track("task_sent", { suggested: SUGGESTED_TASKS.some((t) => t.text === text), learnMode: learn.panelOpen });
    send(text);
  };
  const reply = (text: string) => {
    if (attachedList) {
      track("review_checklist_sent", { checked: attachedList.items.filter((i) => i.checked).length, total: attachedList.items.length, comments: attachedList.items.filter((i) => i.comment.trim()).length });
      send(composeReply(text, attachedList.items));
      review.markSent(attachedList.threadId, attachedList.messageId);
    } else sendTask(text);
    review.closeIn(active.id);
  };
  const lookAt = (messageId: string, path: string) => {
    const item = active.items.find((i) => i.messageId === messageId && i.kind === "file" && i.title === path);
    if (item) focusThreadItem(item.id);
  };

  // Latest learnable turn in this thread without a learning session yet.
  const canStart = (() => {
    const turn = active.turns.at(-1);
    if (!turn) return null;
    const lb = learn.learnability(active.id, turn.messageId);
    if (!lb?.learnable || learnedHere(turn.messageId)) return null;
    // An offered refresher for this task goes first: with Learn mode on it starts by itself, and
    // "Pick another goal" still leads to goal cards for the task.
    const nudge = learn.contextual(active.id, turn.messageId);
    const contextual = !!nudge && !nudge.dismissed;
    return { messageId: turn.messageId, trigger: turn.status === "done" ? ("post_task" as const) : ("live" as const), contextual };
  })();

  // Learn mode on ⇒ the learning agent is on: it starts on each new learnable task in view without waiting
  // for a click, and follows the conversation to the newest task. An active refresher is left to finish.
  const startFor = (c: NonNullable<typeof canStart>) =>
    c.contextual ? learn.acceptContextual(active.id, c.messageId) : learn.start(active.id, c.messageId, c.trigger);
  const followsTask = !session || (session.messageId !== canStart?.messageId && (session.ended || session.trigger === "live" || session.trigger === "post_task"));
  const autoStart = learn.panelOpen && canStart && followsTask ? canStart : null;
  const autoKey = autoStart ? `${active.id}:${autoStart.messageId}` : null;
  const autoStarted = useRef<string | null>(null);
  useEffect(() => {
    if (!autoStart || !autoKey || autoStarted.current === autoKey) return;
    autoStarted.current = autoKey;
    if (autoStart.contextual) learn.acceptContextual(active.id, autoStart.messageId);
    else learn.start(active.id, autoStart.messageId, autoStart.trigger);
  }, [autoKey, autoStart, active.id, learn]);

  const toggleLearn = () => {
    if (learn.panelOpen) return learn.setPanelOpen(false);
    learn.setPanelOpen(true);
    setTab("session");
    openSheet();
    if (canStart && followsTask) startFor(canStart);
  };

  // Learn suggestions in Claude's thread can be waved away; once dismissed they stay gone for that task.
  const [dismissedChips, setDismissedChips] = useState<Set<string>>(() => new Set());
  const chipKey = (messageId: string) => `${active.id}:${messageId}`;
  const dismissChip = (messageId: string) => setDismissedChips((s) => new Set(s).add(chipKey(messageId)));

  const slots: ThreadSlots = {
    afterPrompt: (messageId) => {
      const lb = learn.learnability(active.id, messageId);
      const turn = active.turns.find((t) => t.messageId === messageId);
      if (session?.messageId === messageId) return null;
      // One inline nudge per task: a contextual refresher takes precedence (SPEC §10.3).
      const nudge = learn.contextual(active.id, messageId);
      if (nudge) {
        if (nudge.dismissed) return null;
        return (
          <RefresherChip
            label={nudge.label}
            daysSince={nudge.daysSince}
            interleave={nudge.interleave}
            onAccept={() => {
              setTab("session");
              openSheet();
              learn.acceptContextual(active.id, messageId);
            }}
            onDismiss={() => learn.dismissContextual(active.id, messageId)}
          />
        );
      }
      if (!worthSuggesting(lb) || turn?.status === "done" || dismissedChips.has(chipKey(messageId))) return null;
      return (
        <LiveLearnChip
          topics={lb.topics}
          onClick={() => {
            openSheet();
            learn.start(active.id, messageId, "live");
          }}
          onDismiss={() => dismissChip(messageId)}
        />
      );
    },
    afterTurn: (messageId) => {
      const list = review.get(active.id, messageId);
      const reopen = list?.view === "closed" && (
        <ReviewReopen list={list} onOpen={() => review.setView(active.id, messageId, "open")} />
      );
      const lb = learn.learnability(active.id, messageId);
      const turn = active.turns.find((t) => t.messageId === messageId);
      if (!worthSuggesting(lb) || turn?.status !== "done" || session?.messageId === messageId || learn.contextual(active.id, messageId) || dismissedChips.has(chipKey(messageId))) return reopen || null;
      return (
        <>
          {reopen}
          <PostTaskLearnChip
            onClick={() => {
              openSheet();
              learn.start(active.id, messageId, "post_task");
            }}
            onDismiss={() => dismissChip(messageId)}
          />
        </>
      );
    },
  };

  const peek =
    !wide && learn.panelOpen && !sheetFull ? (
      <div className="mb-2">
        <LearnPeek thread={active} session={session} onExpand={openSheet} onNudge={(n, accept) => learn.actOnNudge(active.id, n, accept)} />
      </div>
    ) : null;

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className={sidebarCollapsed ? "hidden" : "hidden xl:flex"}>
        <Sidebar
          threads={threads}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={newChat}
          onCollapse={() => {
            setSidebarCollapsed(true);
            store("sidebarCollapsed", 1);
          }}
        />
      </div>
      {navOpen && (
        <div className="fixed inset-0 z-50 flex xl:hidden">
          <Sidebar
            threads={threads}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              setNavOpen(false);
            }}
            onNew={() => {
              newChat();
              setNavOpen(false);
            }}
            onClose={() => setNavOpen(false)}
          />
          <button aria-label="Close chats" onClick={() => setNavOpen(false)} className="flex-1 bg-black/50" />
        </div>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar
          learnOn={learn.panelOpen}
          onToggleLearn={toggleLearn}
          dueCount={dueCount}
          status={status}
          showMenu={sidebarCollapsed}
          onMenu={() => {
            if (!xl) return setNavOpen(true);
            setSidebarCollapsed(false);
            store("sidebarCollapsed", 0);
          }}
          onBell={() => {
            learn.setPanelOpen(true);
            setTab("inbox");
            openSheet();
          }}
        />
        {empty ? (
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-[14vh] pb-6 sm:px-6 sm:pt-[22vh]">
            <h1 className="mb-8 flex items-center gap-3 font-serif text-[32px] font-light tracking-tight sm:mb-10 sm:text-[46px]">
              <Spark /> Back at it, Arvind
            </h1>
            <div className="w-full max-w-[720px]">
              {peek}
              <Composer onSend={sendTask} disabled={busy} variant="hero" />
              <div className="mt-8 sm:mt-12">
                <SuggestionList onPick={sendTask} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <ThreadView thread={active} slots={slots} bottomInset={openList ? reviewInset : 0} className="relative min-h-0 flex-1 overflow-y-auto pt-14 [overflow-anchor:none]" />
            <div className="relative mx-auto w-full max-w-3xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {openList && (
                <div ref={reviewCardRef} className="absolute right-3 bottom-full left-3 z-20 mb-2 flex justify-end sm:left-auto sm:right-6">
                  <ReviewChecklist
                    key={openList.messageId}
                    list={openList}
                    onToggle={(id) => review.toggle(active.id, openList.messageId, id)}
                    onComment={(id, text) => review.comment(active.id, openList.messageId, id, text)}
                    onMinimize={() => review.setView(active.id, openList.messageId, "min")}
                    onClose={() => review.setView(active.id, openList.messageId, "closed")}
                    onAttach={() => review.attach(active.id, openList.messageId, true)}
                    onRetry={() => review.retry(active.id, openList.messageId, reviewInput(active, openList.messageId))}
                    onLook={(path) => lookAt(openList.messageId, path)}
                  />
                </div>
              )}
              {lastList?.view === "min" && !lastList.attached && (
                <div className="mb-2 flex justify-end">
                  <ReviewPill list={lastList} onOpen={() => review.setView(active.id, lastList.messageId, "open")} />
                </div>
              )}
              {peek}
              <Composer
                onSend={reply}
                disabled={busy}
                variant="docked"
                attachment={
                  attachedList
                    ? {
                        label: "Review checklist",
                        detail: reviewDetail(attachedList.items),
                        onRemove: () => review.attach(active.id, attachedList.messageId, false),
                      }
                    : null
                }
              />
            </div>
          </>
        )}
      </main>
      {learn.panelOpen &&
        (wide ? (
          <>
            <div className={`relative flex shrink-0 ${panelCollapsed ? "hidden" : ""}`} style={{ width: Math.min(panelWidth, panelMax()) }}>
              <ResizeHandle
                width={Math.min(panelWidth, panelMax())}
                min={PANEL_MIN}
                max={panelMax()}
                defaultWidth={PANEL_DEFAULT}
                onChange={setPanelWidth}
                onCommit={(w) => store("learnPanelWidth", w)}
              />
              {panel("side")}
            </div>
            {panelCollapsed && <LearnRail thread={active} session={session} onExpand={() => setPanelCollapsed(false)} />}
          </>
        ) : (
          <div className={sheetFull ? "" : "hidden"}>
            <button aria-label="Show Claude's work" onClick={() => setSheetFull(false)} className="fixed inset-0 z-30 bg-black/40" />
            <div className="fixed inset-x-0 bottom-0 z-40 h-[88dvh]">{panel("sheet")}</div>
          </div>
        ))}
    </div>
  );

  // Keep at least ~480px for Claude's thread (plus the chats sidebar when it's showing).
  function panelMax() {
    const sidebar = xl && !sidebarCollapsed ? 272 : 0;
    return Math.max(PANEL_MIN, Math.min(PANEL_MAX, (typeof window === "undefined" ? 1440 : window.innerWidth) - sidebar - 480));
  }

  function panel(variant: "side" | "sheet") {
    return (
      <LearnPanel
        variant={variant}
        onMinimize={() => (variant === "sheet" ? setSheetFull(false) : setPanelCollapsed(true))}
        thread={active}
        session={session}
        simulated={status ? !status.learningAgent.live : false}
        canStart={canStart}
        error={learn.error}
        onClose={() => learn.setPanelOpen(false)}
        onObjective={(o) => learn.selectObjective(active.id, o)}
        onAnswer={(p, text, sel) => learn.answer(active.id, p, text, sel)}
        onAsk={(text) => learn.ask(active.id, text)}
        onMove={(mv, target, label) => learn.move(active.id, mv, target, label)}
        onNudge={(n, accept) => learn.actOnNudge(active.id, n, accept)}
        onKeepGoing={(target) => learn.keepGoing(active.id, target)}
        onPickAnotherGoal={() => learn.pickAnotherGoal(active.id)}
        onWidgetEngaged={learn.widgetEngaged}
        onWidgetRetry={(a) => learn.retryWidget(active.id, a)}
        tab={tab}
        onTab={setTab}
        onOpenRefresher={openRefresher}
        threadExists={(id) => threads.some((t) => t.id === id)}
        dueCount={dueCount}
      />
    );
  }
}

/** What a review checklist is written from: the user's goal and the work Claude produced for it. */
function reviewInput(thread: Thread, messageId: string): ReviewRequest {
  const turn = thread.turns.find((t) => t.messageId === messageId);
  const items = thread.items.filter((i) => i.messageId === messageId);
  return {
    prompt: thread.items.find((i) => i.messageId === messageId.replace("m", "u"))?.content ?? "",
    summary: turn?.summary ?? "",
    plan: items.find((i) => i.kind === "plan")?.content ?? "",
    files: items.filter((i) => i.kind === "file").map((i) => ({ path: i.title, content: i.content })),
  };
}

function reviewDetail(items: { checked: boolean; comment: string }[]) {
  const comments = items.filter((i) => i.comment.trim()).length;
  return `${items.filter((i) => i.checked).length} of ${items.length} checked${comments ? ` · ${comments} comment${comments > 1 ? "s" : ""}` : ""}`;
}

/** Generic 8-point spark: a nod to the reference, not the Claude logo. */
function Spark() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden className="text-accent">
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="11" y="1.5" width="2" height="9" rx="1" fill="currentColor" transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}

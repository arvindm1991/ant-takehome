"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { band, DAY, estimateOf, now, PRIOR, type Band } from "@/lib/memory/model";
import { resetMemory, useMemory } from "@/lib/memory/store";
import type { Evidence, LearnerMemory } from "@/lib/memory/types";
import { focusThreadItem } from "@/lib/thread/focus";

const BAND: Record<Band, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-raised text-muted" },
  learning: { label: "Learning", cls: "bg-danger-soft text-danger" },
  developing: { label: "Developing", cls: "bg-note-soft text-note" },
  solid: { label: "Solid", cls: "bg-learn-soft text-learn" },
  mastered: { label: "Mastered", cls: "bg-learn-soft text-learn" },
};

const MODE_LABEL: Record<string, string> = { approach: "Approach", predict: "Predict", explain_back: "Explain back", what_if: "What if" };

/** "Your learning": the learner memory made legible (SPEC §6 memory view, §10). */
export function ProgressView({ activeThreadId }: { activeThreadId: string }) {
  const m = useMemory();
  const topics = Object.keys(m.mastery).sort((a, b) => m.mastery[b].lastSeen - m.mastery[a].lastSeen);

  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-[14px] leading-relaxed text-muted">
        Nothing here yet. As you answer questions in learning sessions, your mastery estimates, the evidence behind them, and any misconceptions show up here.
      </div>
    );
  }

  const open = m.misconceptions.filter((x) => !x.resolved);
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-muted">Topics</h3>
        <div className="space-y-2">
          {topics.map((id) => (
            <TopicRow key={id} m={m} id={id} activeThreadId={activeThreadId} />
          ))}
        </div>
      </section>

      {m.misconceptions.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-muted">
            Misconceptions {open.length > 0 && <span className="normal-case text-danger">· {open.length} open</span>}
          </h3>
          <ul className="space-y-1.5">
            {m.misconceptions.map((x) => (
              <li key={x.topicId + x.tag} className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className={x.resolved ? "text-muted line-through" : "text-danger"}>{x.tag}</span>
                  <span className="ml-auto text-[11.5px] text-muted">{x.resolved ? "resolved" : "open"}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{m.topics[x.topicId]?.label ?? x.topicId}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-muted">Sessions</h3>
        <ul className="space-y-1.5">
          {[...m.episodes].reverse().map((ep) => {
            const deltas = ep.topicIds
              .map((id) => ({ id, before: ep.masteryBefore[id] ?? null, after: ep.masteryAfter[id] ?? null }))
              .filter((d) => d.after != null && d.after !== d.before);
            return (
              <li key={ep.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="truncate">{ep.threadTitle || "Untitled task"}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] text-muted">
                    {ep.trigger.replace("_", "-")} · {ago(now(m) - ep.startedAt)}
                  </span>
                </div>
                {deltas.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
                    {deltas.map((d) => (
                      <span key={d.id}>
                        {m.topics[d.id]?.label ?? d.id}: {pct(d.before ?? PRIOR)} → <span className="text-learn">{pct(d.after!)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 text-[12px] text-muted">{ep.endedAt ? "No graded answers" : "In progress"}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center justify-between px-1 pb-2 text-[11.5px] text-muted">
        <span>ⓘ Prototype note: stored in this browser only.</span>
        <button
          onClick={() => {
            if (window.confirm("Clear all learning memory in this browser?")) resetMemory();
          }}
          className="hover:text-danger"
        >
          Reset memory
        </button>
      </div>
    </div>
  );
}

function TopicRow({ m, id, activeThreadId }: { m: LearnerMemory; id: string; activeThreadId: string }) {
  const [open, setOpen] = useState(false);
  const r = m.mastery[id];
  const est = estimateOf(m, id);
  const b = BAND[band(est)];
  const ev = m.evidence.filter((e) => e.topicId === id);
  const due = r.nextDue != null ? r.nextDue - now(m) : null;
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="w-full px-3.5 py-2.5 text-left">
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className={`shrink-0 text-muted transition ${open ? "rotate-90" : ""}`} />
          <span className="truncate text-[14px] font-medium">{m.topics[id]?.label ?? id}</span>
          <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] ${b.cls}`}>{b.label}</span>
        </div>
        <div className="mt-2 flex items-center gap-3 pl-5">
          <div className="relative h-1.5 flex-1 rounded-full bg-raised">
            <div className="absolute inset-y-0 left-0 rounded-full bg-learn" style={{ width: pct(est ?? 0) }} />
          </div>
          <Sparkline values={[PRIOR, ...ev.map((e) => e.estimateAfter)]} />
          <span className="w-9 text-right font-mono text-[12px] text-muted">{pct(est ?? 0)}</span>
        </div>
        <div className="mt-1 pl-5 text-[11.5px] text-muted">
          {r.attempts} answer{r.attempts === 1 ? "" : "s"}
          {due != null && ` · review ${due <= 0 ? "due now" : `in ${Math.max(1, Math.round(due / DAY))}d`}`}
        </div>
      </button>
      {open && (
        <ol className="space-y-2 border-t border-border px-3.5 py-2.5">
          {[...ev].reverse().map((e) => (
            <EvidenceRow key={e.id} e={e} m={m} canJump={e.threadId === activeThreadId} />
          ))}
        </ol>
      )}
    </div>
  );
}

function EvidenceRow({ e, m, canJump }: { e: Evidence; m: LearnerMemory; canJump: boolean }) {
  const dot = { correct: "bg-learn", partial: "bg-note", incorrect: "bg-danger" }[e.verdict];
  return (
    <li className="flex gap-2.5 text-[12.5px]">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <div className="text-muted">
          {MODE_LABEL[e.mode] ?? e.mode} · {e.verdict}
          {e.hinted && " · after hint"} · {ago(now(m) - e.ts)} · mastery {pct(e.estimateAfter)}
        </div>
        <div className="line-clamp-2">{e.probe}</div>
        <div className="line-clamp-2 italic text-muted">“{e.answer}”</div>
        {canJump && e.threadItemRefs[0] && (
          <button onClick={() => focusThreadItem(e.threadItemRefs[0])} className="mt-0.5 text-[11.5px] text-learn hover:underline">
            See in thread ↗
          </button>
        )}
      </div>
    </li>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="w-14" />;
  const w = 56,
    h = 16;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - v * h}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 text-learn" aria-label="mastery over time">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
function ago(ms: number) {
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < DAY) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / DAY)}d ago`;
}

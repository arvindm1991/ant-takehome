"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import type { WidgetState } from "@/lib/learn/types";
import { frameWidgetHtml } from "@/lib/learn/widgets/frame";

/** Sandboxed interactive widget (no same-origin, CSP blocks network). SPEC §9.2 demonstrate. */
export function Widget({ state, title, onEngaged, onRetry }: { state: WidgetState | undefined; title: string; onEngaged: () => void; onRetry: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
  const engaged = useRef(false);
  const html = state?.html;
  const srcDoc = useMemo(() => (html ? frameWidgetHtml(html) : ""), [html]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.data?.__widget) return;
      if (e.data.type === "resize") setHeight(Math.min(Math.max(Number(e.data.height) || 0, 120), 1200));
      if (e.data.type === "engaged" && !engaged.current) {
        engaged.current = true;
        onEngaged();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onEngaged]);

  if (!state || state.status === "building") {
    return (
      <div className="flex h-28 items-center justify-center gap-2 rounded-lg border border-dashed border-lsa-border text-[13px] text-muted">
        <Loader2 size={14} className="animate-spin" /> <span className="shimmer">Building an interactive demo from Claude&apos;s code…</span>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
        Couldn&apos;t build the demo: {state.error}
        <button onClick={onRetry} className="ml-2 inline-flex items-center gap-1 underline">
          <RotateCcw size={12} /> Retry
        </button>
      </div>
    );
  }
  return (
    <div>
      <iframe
        ref={ref}
        title={title}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
        className="w-full rounded-lg border border-lsa-border bg-lsa-surface"
      />
      <div className="mt-1 text-[11px] text-muted">
        {state.generated ? "Generated live by Claude for this session · sandboxed" : "Pre-built demo widget (mock mode) · live mode generates this with Opus"}
      </div>
    </div>
  );
}

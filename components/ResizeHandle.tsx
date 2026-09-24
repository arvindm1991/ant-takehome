"use client";
import { useRef, useState } from "react";

/**
 * Drag handle on the left edge of the Learn mode panel: dragging left widens the panel and shrinks
 * Claude's thread. Arrow keys nudge it; double-click resets it.
 */
export function ResizeHandle({ width, min, max, onChange, onCommit, defaultWidth }: { width: number; min: number; max: number; onChange: (w: number) => void; onCommit: (w: number) => void; defaultWidth: number }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));
  const end = () => {
    start.current = null;
    setDragging(false);
    onCommit(width);
  };
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize learn mode panel"
        aria-valuenow={width}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, w: width };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (start.current) onChange(clamp(start.current.w + (start.current.x - e.clientX)));
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => {
          onChange(clamp(defaultWidth));
          onCommit(clamp(defaultWidth));
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 64 : 24;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const w = clamp(width + (e.key === "ArrowLeft" ? step : -step));
            onChange(w);
            onCommit(w);
          }
        }}
        className="group absolute inset-y-0 -left-1.5 z-20 flex w-3 cursor-col-resize justify-center outline-none"
      >
        <span className={`h-full w-0.5 transition ${dragging ? "bg-learn" : "bg-transparent group-hover:bg-learn/60 group-focus-visible:bg-learn/60"}`} />
      </div>
      {/* While dragging, cover everything (widget iframes included) so the pointer isn't swallowed. */}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </>
  );
}

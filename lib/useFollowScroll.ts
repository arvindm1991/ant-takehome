"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Follow new content only while the reader is at the bottom. Scrolling up (wheel, touch, keys,
 * scrollbar) pauses following until they scroll back down or `resume()` is called (e.g. they act).
 * Returns a callback ref for the scroll container.
 */
export function useFollowScroll() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const follow = useRef(true);
  const lastTop = useRef(0);
  // The app's own smooth scroll in flight, so its movement isn't mistaken for the reader's.
  const auto = useRef<{ target: number; until: number } | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!el) return;
    const onScroll = () => {
      const top = el.scrollTop;
      const atBottom = el.scrollHeight - top - el.clientHeight < 48;
      const a = auto.current && Date.now() < auto.current.until ? auto.current : null;
      if (a && Math.abs(top - a.target) < 2) auto.current = null;
      const appScrollingUp = !!a && a.target < lastTop.current;
      if (atBottom) follow.current = true;
      // Any upward scroll is the reader's (wheel, touch, keys, scrollbar, even over a widget iframe),
      // unless the app itself is scrolling up to a target.
      else if (top < lastTop.current - 2 && !appScrollingUp) follow.current = false;
      lastTop.current = top;
      setPaused(!follow.current);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) follow.current = false;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, [el]);

  const scrollTo = useCallback(
    (top: number) => {
      if (!el) return;
      const target = Math.max(0, Math.min(top, el.scrollHeight - el.clientHeight));
      auto.current = { target, until: Date.now() + 1000 };
      el.scrollTo({ top: target, behavior: "smooth" });
    },
    [el],
  );
  const scrollToBottom = useCallback(() => el && scrollTo(el.scrollHeight - el.clientHeight), [el, scrollTo]);
  // Ref-only so they're safe to call from effects; `paused` catches up on the next scroll event.
  const resume = useCallback(() => {
    follow.current = true;
  }, []);
  const pause = useCallback(() => {
    follow.current = false;
  }, []);
  const following = useCallback(() => follow.current, []);

  return { ref: setEl, el, following, paused, scrollTo, scrollToBottom, resume, pause };
}

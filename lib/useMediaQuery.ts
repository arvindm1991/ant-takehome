"use client";
import { useSyncExternalStore } from "react";

/** Live CSS media-query match (client-only app, so the server snapshot is just a default). */
export function useMediaQuery(query: string, serverDefault = true) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}

/** Side-by-side learning panel from Tailwind's `lg` breakpoint; below it the learning agent is a bottom sheet. */
export const useWidePanel = () => useMediaQuery("(min-width: 1024px)");

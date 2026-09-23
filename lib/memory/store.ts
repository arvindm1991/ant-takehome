"use client";
// Browser-local learner memory. localStorage can be unavailable (private mode,
// blocked storage), so every access is guarded and the app works in-memory.
import { useSyncExternalStore } from "react";
import { emptyMemory, type LearnerMemory } from "./types";

const KEY = "learnMode.v1";
let state: LearnerMemory | null = null;
const listeners = new Set<() => void>();

function load(): LearnerMemory {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LearnerMemory;
      if (parsed?.version === 1) return { ...emptyMemory(), ...parsed };
    }
  } catch {
    /* fall through */
  }
  return emptyMemory();
}

export function getMemory(): LearnerMemory {
  if (state === null) state = typeof window === "undefined" ? emptyMemory() : load();
  return state;
}

export function updateMemory(fn: (m: LearnerMemory) => LearnerMemory) {
  const next = fn(getMemory());
  if (next === state) return;
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* keep in memory only */
  }
  listeners.forEach((l) => l());
}

export function resetMemory() {
  updateMemory(() => emptyMemory());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const serverSnapshot = emptyMemory();

export function useMemory(): LearnerMemory {
  return useSyncExternalStore(subscribe, getMemory, () => serverSnapshot);
}

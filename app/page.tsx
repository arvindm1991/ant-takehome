"use client";
import { useSyncExternalStore } from "react";
import { App } from "@/components/App";

const noop = () => () => {};

/**
 * Chats and learner memory live in this browser (localStorage), so the app renders
 * client-only to avoid a server/client hydration mismatch.
 */
export default function Home() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  return isClient ? <App /> : <div className="h-full bg-bg" />;
}

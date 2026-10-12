"use client";
import { useSyncExternalStore } from "react";
import { App } from "@/components/App";

const noop = () => () => {};

/**
 * Showcase: opens the login-page task near its end so the review checklist appears in a few seconds.
 * Its own path so it shows up separately in page views. Same client-only rendering as the home page.
 */
export default function Demo() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  return isClient ? <App demo="review" /> : <div className="h-full bg-bg" />;
}

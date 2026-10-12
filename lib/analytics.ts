// Vercel Web Analytics, loaded by a script tag in app/layout.tsx (production on Vercel only).
// Page views are automatic; this records named events. A no-op when the script isn't there.

type Va = (kind: "event", payload: { name: string; data?: Record<string, string | number | boolean> }) => void;

export function track(name: string, data?: Record<string, string | number | boolean>) {
  try {
    (window as unknown as { va?: Va }).va?.("event", { name, data });
  } catch {
    /* analytics must never break the app */
  }
}

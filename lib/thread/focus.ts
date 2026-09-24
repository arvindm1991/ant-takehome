/** Fired whenever something asks to show a main-thread item (the mobile mentor sheet steps aside for it). */
export const THREAD_FOCUS_EVENT = "thread-focus";

/** Scroll a main-thread item into view and flash it (learning-agent anchors, SPEC §6). */
export function focusThreadItem(id: string, { stepAside = true } = {}) {
  const el = document.getElementById(`item-${id}`);
  if (!el) return;
  if (stepAside) window.dispatchEvent(new CustomEvent(THREAD_FOCUS_EVENT, { detail: id }));
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("anchor-flash");
  void el.offsetWidth; // restart animation
  el.classList.add("anchor-flash");
  setTimeout(() => el.classList.remove("anchor-flash"), 2100);
}

/** Scroll a main-thread item into view and flash it (learning-agent anchors, SPEC §6). */
export function focusThreadItem(id: string) {
  const el = document.getElementById(`item-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("anchor-flash");
  void el.offsetWidth; // restart animation
  el.classList.add("anchor-flash");
  setTimeout(() => el.classList.remove("anchor-flash"), 2100);
}

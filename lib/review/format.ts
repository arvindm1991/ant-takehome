// Turning a filled checklist into part of the user's reply to Claude, and back for display.
import type { ReviewItem } from "./types";

const HEADER = "Review checklist";
const SEP = `\n\n${HEADER} (`;

export function formatReview(items: Pick<ReviewItem, "text" | "checked" | "comment">[]): string {
  const done = items.filter((i) => i.checked).length;
  const lines = items.map((i) => {
    const c = i.comment.trim().replace(/\s+/g, " ");
    return `- [${i.checked ? "x" : " "}] ${i.text}${c ? `\n  Comment: ${c}` : ""}`;
  });
  return `${HEADER} (${done} of ${items.length} checked):\n${lines.join("\n")}`;
}

export const DEFAULT_REVIEW_NOTE = "I reviewed your work against this checklist. Please address anything unchecked or commented.";

/** The user's message with the checklist appended. */
export function composeReply(text: string, items: Pick<ReviewItem, "text" | "checked" | "comment">[]): string {
  return `${text.trim() || DEFAULT_REVIEW_NOTE}\n\n${formatReview(items)}`;
}

export type ParsedReview = { done: number; total: number; items: { text: string; checked: boolean; comment: string }[] };

/** Split a sent message back into the typed text and the attached checklist (if any). */
export function splitReply(content: string): { text: string; review: ParsedReview | null } {
  const at = content.indexOf(SEP);
  if (at < 0) return { text: content, review: null };
  const block = content.slice(at + 2);
  const m = block.match(/^Review checklist \((\d+) of (\d+) checked\):\n/);
  if (!m) return { text: content, review: null };
  const items: ParsedReview["items"] = [];
  for (const line of block.slice(m[0].length).split("\n")) {
    const item = line.match(/^- \[( |x)\] (.*)$/);
    const comment = line.match(/^ {2}Comment: (.*)$/);
    if (item) items.push({ text: item[2], checked: item[1] === "x", comment: "" });
    else if (comment && items.length) items[items.length - 1].comment = comment[1];
  }
  return { text: content.slice(0, at), review: { done: Number(m[1]), total: Number(m[2]), items } };
}

/**
 * Signals for research, never shown to the user: did they review, or rubber-stamp?
 * Everything ticked within a few seconds of opening, with no comments, reads as a token choice.
 */
export function reviewSignals(items: ReviewItem[], openedAt: number) {
  const checked = items.filter((i) => i.checked);
  const comments = items.filter((i) => i.comment.trim()).length;
  const lastCheck = Math.max(0, ...checked.map((i) => i.checkedAt ?? 0));
  const secondsToFinish = checked.length ? Math.round((lastCheck - openedAt) / 1000) : null;
  const rubberStamp = checked.length === items.length && comments === 0 && secondsToFinish !== null && secondsToFinish < items.length * 2;
  return { checked: checked.length, total: items.length, comments, secondsToFinish, rubberStamp };
}

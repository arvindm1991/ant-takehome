import { describe, expect, it } from "vitest";
import { composeReply, formatReview, reviewSignals, splitReply, DEFAULT_REVIEW_NOTE } from "./format";
import { mockChecklist } from "./mock";
import { sanitizeReviewRequest } from "./server";
import type { ReviewItem } from "./types";

const item = (text: string, checked: boolean, comment = "", checkedAt?: number): ReviewItem => ({ id: text, text, lookAt: "", checked, comment, checkedAt });

describe("review checklist", () => {
  it("formats a filled checklist and reads it back", () => {
    const items = [item("No hardcoded secrets", true), item("Token expiry is checked", false, "I don't see exp being checked\nanywhere")];
    const text = composeReply("Looks close", items);
    expect(text).toContain("Review checklist (1 of 2 checked):");
    expect(text).toContain("- [ ] Token expiry is checked\n  Comment: I don't see exp being checked anywhere");
    const back = splitReply(text);
    expect(back.text).toBe("Looks close");
    expect(back.review).toEqual({ done: 1, total: 2, items: [{ text: "No hardcoded secrets", checked: true, comment: "" }, { text: "Token expiry is checked", checked: false, comment: "I don't see exp being checked anywhere" }] });
  });

  it("uses a default note when the reply is only the checklist", () => {
    expect(composeReply("  ", [item("A", false)]).startsWith(DEFAULT_REVIEW_NOTE)).toBe(true);
  });

  it("leaves ordinary messages alone", () => {
    expect(splitReply("Add a logout button")).toEqual({ text: "Add a logout button", review: null });
  });

  it("never pre-checks anything", () => {
    expect(formatReview([item("A", false)])).toContain("(0 of 1 checked)");
  });

  it("flags ticking everything in seconds with no comments as a rubber stamp", () => {
    const t0 = 1_000_000;
    const fast = [item("A", true, "", t0 + 1000), item("B", true, "", t0 + 2000), item("C", true, "", t0 + 2500)];
    expect(reviewSignals(fast, t0).rubberStamp).toBe(true);
    const slow = fast.map((i, n) => ({ ...i, checkedAt: t0 + 20_000 * (n + 1) }));
    expect(reviewSignals(slow, t0).rubberStamp).toBe(false);
    expect(reviewSignals([...fast.slice(0, 2), item("C", true, "why?", t0 + 2500)], t0).rubberStamp).toBe(false);
  });

  it("writes task-specific mock checklists that point at real files", () => {
    const req = sanitizeReviewRequest({ prompt: "Build a login page with JWT auth", files: [{ path: "lib/auth.ts", content: "" }, { path: "middleware.ts", content: "" }] });
    const items = mockChecklist(req);
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.some((i) => /hardcoded/i.test(i.text))).toBe(true);
    expect(items.every((i) => i.lookAt === "" || ["lib/auth.ts", "middleware.ts"].includes(i.lookAt))).toBe(true);
  });

  it("bounds the request", () => {
    const r = sanitizeReviewRequest({ prompt: "x".repeat(9000), files: Array.from({ length: 20 }, (_, n) => ({ path: `f${n}`, content: "y".repeat(9000) })) });
    expect(r.prompt.length).toBe(2000);
    expect(r.files.length).toBe(6);
    expect(r.files[0].content.length).toBe(3000);
  });
});

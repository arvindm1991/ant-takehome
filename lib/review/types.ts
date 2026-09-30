// Review checklist: after Claude finishes a task that produced work (files), the user gets a short,
// manually filled checklist of "what good looks like" for that task. It prompts review of the work
// itself; nothing is pre-checked and nothing says whether Claude passed.

export type ReviewCriterion = {
  /** A standard the finished work should meet, phrased so the user can check it themselves. */
  text: string;
  /** Where in Claude's work to look (a file path from the task), or "" if it's about the whole result. */
  lookAt: string;
};

export type ReviewItem = ReviewCriterion & {
  id: string;
  checked: boolean;
  comment: string;
  /** When the user last checked it (ms). Used to spot rubber-stamping, never shown. */
  checkedAt?: number;
};

export type ChecklistView = "open" | "min" | "closed";

export type Checklist = {
  threadId: string;
  messageId: string;
  status: "loading" | "ready" | "error";
  items: ReviewItem[];
  view: ChecklistView;
  /** Attached to the next reply to Claude (shown in the composer). */
  attached: boolean;
  /** Sent to Claude as part of a reply. */
  sent: boolean;
  openedAt: number;
};

/** What the checklist is written from: the user's goal and what Claude produced. */
export type ReviewRequest = {
  prompt: string;
  summary: string;
  plan: string;
  files: { path: string; content: string }[];
};

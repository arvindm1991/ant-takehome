// Main-agent (MA) request builder.
// ISOLATION INVARIANT (SPEC §7.1): this module must never import from lib/learn or
// lib/memory, and its input type carries only the main thread's own messages.
import { repoAsContext } from "@/lib/repo/acmeNotes";

export const MAIN_MODEL = process.env.MAIN_MODEL ?? "claude-opus-5";

export type MainHistoryMessage = { role: "user" | "assistant"; content: string };

export type MainRequestInput = {
  history: MainHistoryMessage[]; // prior turns (assistant = summary text)
  prompt: string;
};

const SYSTEM = `You are Claude, working as a coding agent inside the user's existing repository (shown below). Do the task well, as a senior engineer would.

Respond ONLY with the JSON object required by the output schema:
- complexity: "trivial" for quick factual questions or one-liners that need no files; "task" for real engineering work.
- steps: for "trivial", exactly one step of kind "answer". For "task", in this order:
  1. 2–5 "read" steps: the repo files you inspect before changing anything. title = file path exactly as in the tree; content = one sentence on why you looked at it. Only read files that genuinely inform the change.
  2. one "plan" step: a short markdown plan of the approach and key decisions (and why).
  3. "file" steps: each new or modified file with its complete content. title = file path, lang = language id (ts, tsx, css, …).
  4. optional "command" steps (e.g. dependency installs), lang = "bash".
  5. one final "note" step: what to verify, and any follow-ups.
- lang is "" for non-code steps.
- summary: one or two sentences describing what you did.

Keep files focused and production-minded but concise; this is a small app.

${repoAsContext()}`;

export function buildMainRequest(input: MainRequestInput) {
  return {
    model: MAIN_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" as const, display: "summarized" as const },
    system: SYSTEM,
    messages: [
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: input.prompt },
    ],
  };
}

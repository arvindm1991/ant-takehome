import { z } from "zod";

// Structured output of the main agent (SPEC §8).
export const MainStepSchema = z.object({
  kind: z.enum(["read", "plan", "file", "command", "note", "answer"]),
  title: z.string(),
  content: z.string(),
  lang: z.string(), // "" when not code
});

export const MainResultSchema = z.object({
  complexity: z.enum(["trivial", "task"]),
  steps: z.array(MainStepSchema),
  summary: z.string(),
});

export type MainStep = z.infer<typeof MainStepSchema>;
export type MainResult = z.infer<typeof MainResultSchema>;

// NDJSON events streamed from /api/main to the browser.
export type MainEvent =
  | { type: "thinking"; text: string }
  | { type: "result"; result: MainResult; simulated: boolean }
  | { type: "error"; message: string };

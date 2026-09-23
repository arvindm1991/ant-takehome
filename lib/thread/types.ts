// Thread items with stable IDs (SPEC §7.2). Evidence, episodes and learning-agent
// anchors all reference ThreadItem.id.

export type StepKind = "read" | "plan" | "file" | "command" | "note" | "answer";

export type ItemKind = "user_prompt" | "reasoning" | StepKind;

export type ThreadItem = {
  id: string; // `${threadId}:${messageId}#s${n}` — e.g. "t_7f3:m2#s3"
  threadId: string;
  messageId: string;
  kind: ItemKind;
  title: string;
  content: string;
  lang?: string;
  revealed: boolean;
  revealedAt?: number;
};

export type AssistantTurn = {
  messageId: string;
  status: "thinking" | "revealing" | "done" | "error";
  complexity?: "trivial" | "task";
  summary?: string;
  error?: string;
  simulated?: boolean; // mock response (no API key)
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  items: ThreadItem[];
  turns: AssistantTurn[];
};

export const itemId = (threadId: string, messageId: string, n: number) =>
  `${threadId}:${messageId}#s${n}`;

export const shortId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 7)}`;

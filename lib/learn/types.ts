// Learning sub-agent (LSA) domain types. SPEC §9.

export type Topic = { id: string; label: string };

export type Learnability = { learnable: boolean; topics: Topic[] };

export type Objective = { topicId: string; label: string; why: string };

export type ProbeMode = "approach" | "predict" | "explain_back" | "what_if";

export type Verdict = "correct" | "partial" | "incorrect";

/** Actions the LSA can take, one per tool (SPEC §9.2). */
export type LearnAction =
  | { kind: "objectives"; objectives: Objective[] }
  | {
      kind: "probe";
      id: string;
      mode: ProbeMode;
      format: "free_text" | "mcq";
      question: string;
      options: string[]; // mcq only
      topicId: string;
      anchors: string[];
      rubric: string;
    }
  | { kind: "hint"; text: string; topicId: string; anchors: string[] }
  | { kind: "explain"; text: string; topicId: string; anchors: string[] }
  | { kind: "demonstrate"; id: string; title: string; spec: string; topicId: string; anchors: string[] }
  | { kind: "end"; recap: string };

/** What the learner sees in the panel, in order. */
export type FeedEntry =
  | { kind: "action"; action: LearnAction; at: number }
  | { kind: "answer"; probeId: string; text: string; selected: string[]; at: number }
  | { kind: "feedback"; probeId: string; verdict: Verdict; text: string; anchors: string[]; misconceptionTag: string; at: number }
  | { kind: "reveal"; probeId: string; picked: string[]; actual: { path: string; why: string; itemId: string }[]; verdict: Verdict; at: number }
  | { kind: "user"; text: string; at: number }
  | { kind: "waiting"; probeId: string; text: string; at: number };

export type SessionTrigger = "live" | "post_task" | "refresher" | "contextual";

export type WidgetState = { status: "building" | "ready" | "error"; html?: string; error?: string; generated?: boolean };

export type WidgetRequest = { title: string; spec: string; topicId: string; trajectory: TrajectoryItem[] };

export type LearnSession = {
  id: string;
  threadId: string;
  messageId: string; // the main-agent turn this session learns from
  trigger: SessionTrigger;
  topics: Topic[];
  objective: Objective | null;
  feed: FeedEntry[];
  widgets: Record<string, WidgetState>;
  busy: boolean;
  ended: boolean;
  startedAt: number;
};

/** Events that wake the LSA (SPEC §9.5). */
export type LearnEvent =
  | { type: "session_start" }
  | { type: "objective_selected" }
  | { type: "answer_submitted"; probeId: string }
  | { type: "answer_graded"; probeId: string; verdict: Verdict }
  | { type: "user_message"; text: string }
  | { type: "main_agent_done" };

/** Read-only view of the main thread passed to the LSA (SPEC §7.1). */
export type TrajectoryItem = {
  id: string;
  kind: string;
  title: string;
  content: string;
  revealed: boolean;
};

/** Learner memory slice for the LSA (built by lib/memory/model.learnerStateFor). */
export type LearnerStateView = {
  topics: { id: string; label: string; estimate: number | null; attempts: number; band: string; openMisconceptions: string[] }[];
  evidence: { topicId: string; mode: ProbeMode; verdict: Verdict; hinted: boolean; probe: string; answer: string; daysAgo: number }[];
  knownTopics: { id: string; label: string; estimate: number | null }[];
};

export type LearnRequest = {
  event: LearnEvent;
  learner: LearnerStateView;
  userPrompt: string;
  mainAgentStatus: "working" | "done";
  trajectory: TrajectoryItem[];
  repoTree: string[];
  topics: Topic[];
  objective: Objective | null;
  feed: FeedEntry[];
  strategy: string;
};

export type GradeRequest = {
  probe: Extract<LearnAction, { kind: "probe" }>;
  answer: string;
  trajectory: TrajectoryItem[];
};

export type GradeResult = {
  verdict: Verdict;
  misconceptionTag: string;
  feedback: string;
  revealAnchors: string[];
};

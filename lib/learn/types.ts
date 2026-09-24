// Learning sub-agent (LSA) domain types. SPEC §9.

export type Topic = { id: string; label: string };

/** relatedKnown: ids of previously studied topics this request builds on (interleaving). */
export type Learnability = { learnable: boolean; topics: Topic[]; relatedKnown?: string[] };

export type ObjectiveKind = "orient" | "core" | "stretch";

/**
 * A learning goal card. `label` is an ability ("Explain to a teammate why bcrypt beats
 * SHA-256"), `why` ties it to what the main agent is doing now, `teaser` is an optional
 * curiosity question (used on the orient card).
 */
export type Objective = {
  topicId: string;
  topicLabel?: string; // short topic name for memory/progress ("password hashing")
  label: string;
  why: string;
  minutes?: number;
  kind?: ObjectiveKind;
  teaser?: string;
};

/** Where the learner can go next. "dig_deeper" = one level into the mechanism; "zoom_out" = a sibling concept. */
export type MoveKind =
  | "dig_deeper"
  | "zoom_out"
  | "hands_on"
  | "hint"
  | "show_code"
  | "easier"
  | "quiz"
  | "explain"
  | "show"
  | "challenge"
  | "keep_going";

/** Concept trail carried by every teaching move: drives the breadcrumb and next-move labels. */
export type Trail = { concept: string; deeper: string; sibling: string };

export type ProbeMode = "approach" | "predict" | "explain_back" | "what_if";

export type Verdict = "correct" | "partial" | "incorrect";

/** Actions the LSA can take, one per tool (SPEC §9.2). */
export type LearnAction =
  | { kind: "objectives"; objectives: Objective[] }
  | ({
      kind: "probe";
      id: string;
      mode: ProbeMode;
      format: "free_text" | "mcq";
      question: string;
      options: string[]; // mcq only
      topicId: string;
      anchors: string[];
      rubric: string;
    } & Partial<Trail>)
  | { kind: "hint"; text: string; topicId: string; anchors: string[] }
  | ({ kind: "explain"; text: string; topicId: string; anchors: string[] } & Partial<Trail>)
  | ({ kind: "demonstrate"; id: string; title: string; spec: string; topicId: string; anchors: string[] } & Partial<Trail>)
  | { kind: "end"; recap: string };

/** What the learner sees in the panel, in order. */
export type FeedEntry =
  | { kind: "action"; action: LearnAction; at: number }
  | { kind: "answer"; probeId: string; text: string; selected: string[]; at: number }
  | { kind: "feedback"; probeId: string; verdict: Verdict; text: string; anchors: string[]; misconceptionTag: string; at: number }
  | { kind: "reveal"; probeId: string; picked: string[]; actual: { path: string; why: string; itemId: string }[]; verdict: Verdict; at: number }
  | { kind: "user"; text: string; at: number }
  | { kind: "move"; move: MoveKind; label: string; at: number }
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
  moveTarget: number; // questions in this session's arc ("move 2 of 3")
  objectiveAt?: number; // when the goal was chosen (proactive nudges only for later steps)
  actedNudges: string[]; // proactive nudges the learner has acted on or dismissed
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
  | { type: "main_agent_done" }
  | { type: "move"; move: MoveKind; target: string }
  | { type: "step_revealed"; itemId: string; itemTitle: string; probeId: string | null }
  | { type: "refresher_start"; topicId: string; topicLabel: string; daysSince: number; interleaveWith: string | null };

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
  sessionTrigger: SessionTrigger;
  learner: LearnerStateView;
  userPrompt: string;
  mainAgentStatus: "working" | "done";
  trajectory: TrajectoryItem[];
  repoTree: string[];
  topics: Topic[];
  objective: Objective | null;
  feed: FeedEntry[];
  arc: { done: number; target: number };
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

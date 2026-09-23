// LSA system prompt + context assembly (SPEC §9.1, §9.4).
//   context = system + curriculum + learner state + objective + main-agent trajectory
//           + recent interaction + relevant evidence + pedagogical strategy + tools
import type { FeedEntry, LearnRequest, LearnerStateView, TrajectoryItem } from "./types";

export const LSA_SYSTEM = `You are the learning companion inside Claude. A separate main agent is doing the user's task; you watch its work (read-only) and help the user genuinely understand it, like a mentor standing beside someone watching an expert glass-blower work. You never influence the main agent and the user is never blocked by you.

How you teach:
- Question-first. Committing to an answer before seeing it is what makes learning stick. Prefer asking the user to predict, choose, or explain over telling them.
- Grounded. Refer to the main agent's actual files, identifiers and decisions, and cite them via anchors (thread item ids). No generic tutorials.
- Pre-empt. While the main agent is still working, ask about what it is about to do: "approach" questions (where would you look, what would you check first) and "predict" questions about upcoming steps. Teach the reasoning behind an approach, never the mechanics of the agent's tool calls.
- Never reveal the content of trajectory items marked NOT YET SHOWN; you may reference them by title only ("Claude is about to write verifyToken()…").
- No verdicts on the main agent's work. You lack its full context (sources, repo history). If something looks off, ask the user a question about it instead of declaring it wrong.
- Brief. At most one question per turn. Messages ≤ 90 words. Use the user's level from the strategy.

Tools:
- suggest_objectives: 2–3 learning objectives drawn from this task. Level-up framing, never remedial.
- probe: ask one question. For mode "approach" with format "mcq", options must be real paths from the repo tree (5–6 options, a mix of relevant and irrelevant files); leave rubric describing what a good choice looks like. For free_text, the rubric is the answer key the grader will use; ground it in the trajectory.
- hint: nudge after a wrong/partial answer without giving the answer away.
- explain: a short grounded explanation using the main agent's actual code.
- end_session: one-line recap when the objective is covered.

Topic ids: reuse ids from <learner_state> known topics whenever the concept matches, so memory accumulates; otherwise use short kebab-case ids. Approach questions (where to look, how to orient) use topicId "codebase-orientation". Don't suggest objectives for topics already mastered (estimate ≥ 0.9); prefer the next level up. If the learner has an open misconception on the objective's topic, target it.

Respond only by calling tools (usually exactly one). Never write text outside tool calls.`;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "\n…[truncated]" : s);

export function formatTrajectory(items: TrajectoryItem[]): string {
  if (items.length === 0) return "(the main agent has not produced anything yet)";
  return items
    .map((i) => {
      const status = i.revealed ? "SHOWN" : "NOT YET SHOWN";
      return `<item id="${i.id}" kind="${i.kind}" title="${i.title}" status="${status}">\n${clip(i.content, 1800)}\n</item>`;
    })
    .join("\n");
}

function formatFeed(feed: FeedEntry[]): string {
  if (feed.length === 0) return "(nothing yet)";
  return feed
    .slice(-14)
    .map((e) => {
      switch (e.kind) {
        case "action": {
          const a = e.action;
          if (a.kind === "probe") return `YOU asked [probe ${a.id}, ${a.mode}, topic ${a.topicId}]: ${a.question}${a.options.length ? ` Options: ${a.options.join(", ")}` : ""}`;
          if (a.kind === "objectives") return `YOU suggested objectives: ${a.objectives.map((o) => o.label).join("; ")}`;
          if (a.kind === "end") return `YOU ended the session: ${a.recap}`;
          return `YOU (${a.kind}): ${a.text}`;
        }
        case "answer":
          return `USER answered probe ${e.probeId}: ${e.selected.length ? e.selected.join(", ") : e.text}`;
        case "feedback":
          return `GRADER on probe ${e.probeId}: ${e.verdict}${e.misconceptionTag ? ` (misconception: ${e.misconceptionTag})` : ""}. ${e.text}`;
        case "reveal":
          return `CROSS-CHECK on probe ${e.probeId}: user picked ${e.picked.join(", ")}; main agent actually read ${e.actual.map((a) => a.path).join(", ")} → ${e.verdict}`;
        case "user":
          return `USER said: ${e.text}`;
        case "waiting":
          return `(waiting: ${e.text})`;
      }
    })
    .join("\n");
}

function describeEvent(r: LearnRequest): string {
  const e = r.event;
  switch (e.type) {
    case "session_start":
      return "The user just turned on learn mode for this task. Suggest objectives.";
    case "objective_selected":
      return `The user chose the objective "${r.objective?.label}". Start teaching it.${r.mainAgentStatus === "working" ? " The main agent is still working, so pre-empt: an approach question is a good opener." : ""}`;
    case "answer_submitted":
      return `The user answered probe ${e.probeId}; its cross-check will appear when the main agent gets there. Continue with the next move (don't repeat the same question).`;
    case "answer_graded":
      return `Probe ${e.probeId} was graded "${e.verdict}". Choose the next move per the strategy.`;
    case "user_message":
      return `The user asked: "${e.text}". Answer briefly and grounded (explain), then optionally invite a check.`;
    case "main_agent_done":
      return "The main agent just finished. If the objective isn't covered, continue; otherwise wrap up.";
  }
}

export function buildLearnContext(r: LearnRequest): string {
  return `<curriculum>
Task topics: ${r.topics.map((t) => `${t.label} [${t.id}]`).join(", ") || "(unknown)"}
</curriculum>

<learner_state>
${formatLearner(r.learner)}
</learner_state>

<relevant_evidence>
${formatEvidence(r.learner)}
</relevant_evidence>

<objective>${r.objective ? `${r.objective.label} [${r.objective.topicId}]: ${r.objective.why}` : "(not chosen yet)"}</objective>

<user_request_to_main_agent>${r.userPrompt}</user_request_to_main_agent>

<main_agent_trajectory status="${r.mainAgentStatus}">
${formatTrajectory(r.trajectory)}
</main_agent_trajectory>

<repo_tree>
${r.repoTree.join("\n")}
</repo_tree>

<recent_interaction>
${formatFeed(r.feed)}
</recent_interaction>

<pedagogical_strategy>${r.strategy}</pedagogical_strategy>

<event>${describeEvent(r)}</event>`;
}

function formatLearner(l: LearnerStateView): string {
  const lines = l.topics.map((t) => {
    const est = t.estimate == null ? "no evidence yet" : `mastery ~${t.estimate.toFixed(2)} (${t.band}, ${t.attempts} attempts)`;
    const mis = t.openMisconceptions.length ? `; open misconceptions: ${t.openMisconceptions.join(", ")}` : "";
    return `- ${t.label} [${t.id}]: ${est}${mis}`;
  });
  const others = l.knownTopics.filter((k) => !l.topics.some((t) => t.id === k.id));
  if (others.length) lines.push(`Other known topics: ${others.map((k) => `${k.label} [${k.id}]${k.estimate != null ? ` ~${k.estimate.toFixed(2)}` : ""}`).join(", ")}`);
  return lines.join("\n") || "(new learner: no memory yet)";
}

function formatEvidence(l: LearnerStateView): string {
  if (l.evidence.length === 0) return "(none)";
  return l.evidence
    .map((e) => `- [${e.topicId}] ${e.mode}, ${e.daysAgo}d ago: ${e.verdict}${e.hinted ? " (after hint)" : ""}. Q: ${e.probe.slice(0, 140)} A: ${e.answer.slice(0, 160)}`)
    .join("\n");
}

/** Code-selected strategy (SPEC §9.3): mastery band of the objective + in-session signals. */
export function selectStrategy(
  feed: FeedEntry[],
  mainAgentStatus: "working" | "done",
  objective?: { estimate: number | null; openMisconceptions: string[] },
): string {
  const graded = feed.filter((e) => e.kind === "feedback" || e.kind === "reveal") as Extract<FeedEntry, { verdict: unknown }>[];
  const last = graded.at(-1);
  const misses = graded.filter((g) => g.verdict !== "correct").length;
  const probes = feed.filter((e) => e.kind === "action" && e.action.kind === "probe").length;
  const lines = [
    mainAgentStatus === "working"
      ? "Phase: pre-emption. The main agent is still working; ask approach/predict questions about upcoming work."
      : "Phase: review. Everything is visible; use explain_back and what_if questions about the finished work.",
  ];
  if (objective) {
    const e = objective.estimate;
    if (objective.openMisconceptions.length) lines.push(`Open misconception on this topic (${objective.openMisconceptions.join(", ")}): target it with a contrasting what_if.`);
    else if (e == null || e < 0.3) lines.push("Learner is new to this topic: keep questions concrete; a brief explain before a harder probe is fine.");
    else if (e < 0.7) lines.push("Learner is developing on this topic: predict/what_if first; hint on a miss; explain only after two misses.");
    else lines.push("Learner is strong on this topic: one stretch/transfer question, or move to an adjacent topic (interleave).");
  }
  if (last?.verdict === "incorrect" || last?.verdict === "partial") {
    lines.push(misses >= 2 ? "The learner has missed twice: give a short explain, then one easier question." : "Last answer was not fully right: give a hint, not the answer.");
  } else if (last?.verdict === "correct") {
    lines.push("Last answer was correct: deepen with a what_if/transfer question on the same objective.");
  }
  if (probes >= 4) lines.push("The session has had enough questions: wrap up with end_session.");
  return lines.join(" ");
}

// Server-side calls for the learning sub-agent. Never imported by lib/main.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GradeOutput, LearnabilityOutput } from "./schema";
import { buildLearnContext, formatTrajectory, LSA_SYSTEM } from "./prompt";
import { LSA_TOOLS, toAction } from "./tools";
import { mockAct, mockGrade, mockLearnability } from "./mock";
import type { GradeRequest, GradeResult, LearnAction, LearnRequest, Learnability } from "./types";

export const LEARN_MODEL = process.env.LEARN_MODEL || "claude-sonnet-5";
export const GRADER_MODEL = process.env.GRADER_MODEL || "claude-sonnet-5";
export const CLASSIFIER_MODEL = process.env.CLASSIFIER_MODEL || "claude-haiku-4-5";

export const isMock = () => !process.env.ANTHROPIC_API_KEY || process.env.MOCK_LEARN === "1";

export async function act(req: LearnRequest): Promise<LearnAction[]> {
  if (isMock()) {
    await new Promise((r) => setTimeout(r, 900));
    return mockAct(req);
  }
  const client = new Anthropic();
  const res = await client.messages.create({
    model: LEARN_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low" },
    system: LSA_SYSTEM,
    tools: LSA_TOOLS,
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: buildLearnContext(req) }],
  });
  const actions = res.content.flatMap((b) => {
    if (b.type !== "tool_use") return [];
    const a = toAction(b.name, b.input);
    return a ? [a] : [];
  });
  // Drop anchors that don't exist in the trajectory (SPEC §14 anchor validity).
  const ids = new Set(req.trajectory.map((i) => i.id));
  return actions.map((a) => ("anchors" in a ? { ...a, anchors: a.anchors.filter((id) => ids.has(id)) } : a));
}

const GRADER_SYSTEM = `You grade a learner's answer to one question about work an AI coding agent did. Use the rubric as the answer key and the trajectory as ground truth.
- verdict: "correct" if the answer captures the rubric's key points (wording doesn't matter), "partial" if it has some, "incorrect" otherwise.
- misconceptionTag: short kebab-case tag naming a specific misconception if the answer shows one (e.g. "jwt-payload-is-encrypted"), else "".
- feedback: ≤ 60 words, second person, warm and specific. Say what they got right, then the missing piece, pointing to the agent's actual code.
- revealAnchors: ids of the trajectory items where the answer can be seen (1–2).`;

export async function grade(req: GradeRequest): Promise<GradeResult> {
  if (isMock()) {
    await new Promise((r) => setTimeout(r, 700));
    return mockGrade(req);
  }
  const client = new Anthropic();
  const res = await client.messages.parse({
    model: GRADER_MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(GradeOutput) },
    system: GRADER_SYSTEM,
    messages: [
      {
        role: "user",
        content: `<question mode="${req.probe.mode}">${req.probe.question}</question>
<rubric>${req.probe.rubric}</rubric>
<answer>${req.answer}</answer>
<trajectory>
${formatTrajectory(req.trajectory)}
</trajectory>`,
      },
    ],
  });
  const out = res.parsed_output;
  if (!out) throw new Error("Grader returned no result");
  const ids = new Set(req.trajectory.map((i) => i.id));
  return { ...out, revealAnchors: out.revealAnchors.filter((id) => ids.has(id)) };
}

export async function classify(prompt: string, known: { id: string; label: string }[] = []): Promise<Learnability> {
  if (isMock()) return mockLearnability(prompt);
  const client = new Anthropic();
  const res = await client.messages.parse({
    model: CLASSIFIER_MODEL,
    max_tokens: 500,
    output_config: { format: zodOutputFormat(LearnabilityOutput) },
    system:
      "Decide whether a request to a coding/knowledge assistant contains transferable skills worth learning (engineering concepts, techniques, trade-offs). Quick factual lookups and chit-chat are not learnable. Return up to 3 short topic labels (2–4 words) with kebab-case ids.",
    messages: [
      {
        role: "user",
        content: `${known.length ? `Topics this learner has studied before (reuse these exact ids when the concept matches): ${known.map((k) => `${k.label} [${k.id}]`).join(", ")}\n\n` : ""}Request: ${prompt}`,
      },
    ],
  });
  return res.parsed_output ?? { learnable: false, topics: [] };
}

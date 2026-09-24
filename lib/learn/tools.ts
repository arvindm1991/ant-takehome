import { z } from "zod";
import { DemonstrateInput, EndSessionInput, ExplainInput, HintInput, ProbeInput, SuggestObjectivesInput } from "./schema";
import type { LearnAction } from "./types";

const jsonSchema = (s: z.ZodType) => {
  const { $schema, ...rest } = z.toJSONSchema(s) as Record<string, unknown>;
  void $schema;
  return rest as { type: "object"; [k: string]: unknown };
};

export const LSA_TOOLS = [
  {
    name: "suggest_objectives",
    description:
      "Offer 4–5 learning goals as a journey: one 'orient' (where to look in the repo, with a teaser question), 2–3 'core' concepts from this task, one 'stretch'. outcome = what the learner will be able to do; whyNow = one line tied to what the main agent is doing now; minutes = rough time.",
    input_schema: jsonSchema(SuggestObjectivesInput),
  },
  { name: "probe", description: "Ask the learner one question (approach, predict, explain_back or what_if).", input_schema: jsonSchema(ProbeInput) },
  { name: "hint", description: "Nudge after a wrong or partial answer without revealing it.", input_schema: jsonSchema(HintInput) },
  { name: "explain", description: "Short explanation grounded in the main agent's actual code.", input_schema: jsonSchema(ExplainInput) },
  {
    name: "demonstrate",
    description:
      "Request an interactive widget (sliders, toggles, live output) that lets the learner manipulate the concept using the main agent's actual values. 'spec' describes what to show and which values/code to ground it in; a separate builder generates it.",
    input_schema: jsonSchema(DemonstrateInput),
  },
  { name: "end_session", description: "Wrap up with a one-line recap.", input_schema: jsonSchema(EndSessionInput) },
];

let seq = 0;
const actionId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
const probeId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Validate a tool call and convert it to a LearnAction; null if malformed. */
export function toAction(name: string, input: unknown): LearnAction | null {
  switch (name) {
    case "suggest_objectives": {
      const r = SuggestObjectivesInput.safeParse(input);
      return r.success
        ? {
            kind: "objectives",
            objectives: r.data.objectives.map((o) => ({
              topicId: o.topicId,
              topicLabel: o.topicLabel,
              label: o.outcome,
              why: o.whyNow,
              minutes: Math.min(15, Math.max(1, Math.round(o.minutes))),
              kind: o.kind,
              teaser: o.teaser,
            })),
          }
        : null;
    }
    case "probe": {
      const r = ProbeInput.safeParse(input);
      return r.success ? { kind: "probe", id: probeId(), ...r.data } : null;
    }
    case "hint": {
      const r = HintInput.safeParse(input);
      return r.success ? { kind: "hint", ...r.data } : null;
    }
    case "explain": {
      const r = ExplainInput.safeParse(input);
      return r.success ? { kind: "explain", ...r.data } : null;
    }
    case "demonstrate": {
      const r = DemonstrateInput.safeParse(input);
      return r.success ? { kind: "demonstrate", id: actionId("w"), ...r.data } : null;
    }
    case "end_session": {
      const r = EndSessionInput.safeParse(input);
      return r.success ? { kind: "end", recap: r.data.recap } : null;
    }
    default:
      return null;
  }
}

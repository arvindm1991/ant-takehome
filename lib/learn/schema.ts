import { z } from "zod";

// Tool input schemas for the learning sub-agent (SPEC §9.2). All fields are
// required (use "" / [] when not applicable) so they work with strict tool use.

export const SuggestObjectivesInput = z.object({
  objectives: z
    .array(
      z.object({
        topicId: z.string(),
        topicLabel: z.string(),
        outcome: z.string(),
        whyNow: z.string(),
        minutes: z.number(),
        kind: z.enum(["orient", "core", "stretch"]),
        teaser: z.string(),
      }),
    )
    .min(1)
    .max(5),
});

const TrailFields = { concept: z.string(), deeper: z.string(), sibling: z.string() };

export const ProbeInput = z.object({
  mode: z.enum(["approach", "predict", "explain_back", "what_if"]),
  format: z.enum(["free_text", "mcq"]),
  question: z.string(),
  options: z.array(z.string()),
  topicId: z.string(),
  anchors: z.array(z.string()),
  rubric: z.string(),
  ...TrailFields,
});

export const HintInput = z.object({ text: z.string(), topicId: z.string(), anchors: z.array(z.string()) });
export const ExplainInput = z.object({ text: z.string(), topicId: z.string(), anchors: z.array(z.string()), ...TrailFields });
export const DemonstrateInput = z.object({
  title: z.string(),
  spec: z.string(),
  topicId: z.string(),
  anchors: z.array(z.string()),
  ...TrailFields,
});

export const EndSessionInput = z.object({ recap: z.string() });

export const GradeOutput = z.object({
  verdict: z.enum(["correct", "partial", "incorrect"]),
  misconceptionTag: z.string(),
  feedback: z.string(),
  revealAnchors: z.array(z.string()),
});

export const LearnabilityOutput = z.object({
  learnable: z.boolean(),
  topics: z.array(z.object({ id: z.string(), label: z.string() })).max(4),
  relatedKnown: z.array(z.string()),
});

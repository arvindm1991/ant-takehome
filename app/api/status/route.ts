import { MAIN_MODEL } from "@/lib/main/request";
import { CLASSIFIER_MODEL, GRADER_MODEL, LEARN_MODEL, WIDGET_MODEL } from "@/lib/learn/server";

export const dynamic = "force-dynamic";

/** What this deployment runs for real vs scripted (surfaced in the UI). */
export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  return Response.json({
    mainAgent: { live: hasKey && process.env.MOCK_MAIN !== "1", model: MAIN_MODEL },
    learningAgent: { live: hasKey && process.env.MOCK_LEARN !== "1", model: LEARN_MODEL },
    grader: { model: GRADER_MODEL },
    widgetBuilder: { model: WIDGET_MODEL },
    classifier: { model: CLASSIFIER_MODEL },
  });
}

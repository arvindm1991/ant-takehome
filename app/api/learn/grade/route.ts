import { grade } from "@/lib/learn/server";
import { clip, guard } from "@/lib/rateLimit";
import type { GradeRequest } from "@/lib/learn/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req, "learn");
  if (blocked) return blocked;
  const raw = (await req.json()) as GradeRequest;
  const body: GradeRequest = { ...raw, answer: clip(raw.answer, 4000), trajectory: (raw.trajectory ?? []).slice(0, 40) };
  try {
    return Response.json(await grade(body));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

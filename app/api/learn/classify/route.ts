import { classify } from "@/lib/learn/server";
import { clip, guard } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const blocked = guard(req, "learn");
  if (blocked) return Response.json({ learnable: false, topics: [], relatedKnown: [] }); // best-effort: just skip suggestions
  const { prompt, known } = (await req.json()) as { prompt: string; known?: { id: string; label: string }[] };
  try {
    return Response.json(await classify(clip(prompt, 4000), Array.isArray(known) ? known.slice(0, 40) : []));
  } catch {
    return Response.json({ learnable: false, topics: [] });
  }
}

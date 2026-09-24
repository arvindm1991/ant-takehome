import { classify } from "@/lib/learn/server";
import { clampDeep, readJson } from "@/lib/api";
import { guard } from "@/lib/rateLimit";

const NONE = { learnable: false, topics: [], relatedKnown: [] };

// Best-effort: any failure (rate limit, bad input, upstream error) just means no suggestion.
export async function POST(req: Request) {
  if (guard(req, "learn")) return Response.json(NONE);
  const raw = await readJson<{ prompt: string; known?: { id: string; label: string }[] }>(req, 64 * 1024);
  if (raw instanceof Response) return Response.json(NONE);
  const { prompt, known } = clampDeep(raw, { maxString: 4000, maxArray: 40, maxDepth: 4 });
  try {
    return Response.json(await classify(String(prompt ?? ""), Array.isArray(known) ? known : []));
  } catch (err) {
    console.error("[classify]", err);
    return Response.json(NONE);
  }
}

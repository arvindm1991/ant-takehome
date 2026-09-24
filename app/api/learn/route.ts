import { act } from "@/lib/learn/server";
import { clampDeep, errorResponse, readJson } from "@/lib/api";
import { guard } from "@/lib/rateLimit";
import type { LearnRequest } from "@/lib/learn/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req, "learn");
  if (blocked) return blocked;
  const raw = await readJson<LearnRequest>(req);
  if (raw instanceof Response) return raw;
  // Every client-supplied string/array is bounded before it can reach a prompt.
  const body = clampDeep(raw);
  try {
    return Response.json({ actions: await act(body) });
  } catch (err) {
    return errorResponse(err);
  }
}

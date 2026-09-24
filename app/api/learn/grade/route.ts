import { grade } from "@/lib/learn/server";
import { clampDeep, errorResponse, readJson } from "@/lib/api";
import { guard } from "@/lib/rateLimit";
import type { GradeRequest } from "@/lib/learn/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req, "learn");
  if (blocked) return blocked;
  const raw = await readJson<GradeRequest>(req);
  if (raw instanceof Response) return raw;
  try {
    return Response.json(await grade(clampDeep(raw)));
  } catch (err) {
    return errorResponse(err);
  }
}

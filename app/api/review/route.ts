import { writeChecklist, sanitizeReviewRequest } from "@/lib/review/server";
import { errorResponse, readJson } from "@/lib/api";
import { guard } from "@/lib/rateLimit";
import type { ReviewRequest } from "@/lib/review/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req, "learn");
  if (blocked) return blocked;
  const raw = await readJson<Partial<ReviewRequest>>(req, 64 * 1024);
  if (raw instanceof Response) return raw;
  try {
    return Response.json({ items: await writeChecklist(sanitizeReviewRequest(raw ?? {})) });
  } catch (err) {
    console.error("[review]", err);
    return errorResponse(err);
  }
}

import { buildWidget } from "@/lib/learn/server";
import { clampDeep, errorResponse, readJson } from "@/lib/api";
import { guard } from "@/lib/rateLimit";
import type { WidgetRequest } from "@/lib/learn/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const blocked = guard(req, "widget");
  if (blocked) return blocked;
  const raw = await readJson<WidgetRequest>(req);
  if (raw instanceof Response) return raw;
  const body = clampDeep(raw);
  try {
    return Response.json(await buildWidget({ ...body, title: body.title.slice(0, 120), spec: body.spec.slice(0, 3000) }));
  } catch (err) {
    return errorResponse(err);
  }
}

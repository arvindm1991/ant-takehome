import { buildWidget } from "@/lib/learn/server";
import { clip, guard } from "@/lib/rateLimit";
import type { WidgetRequest } from "@/lib/learn/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const blocked = guard(req, "widget");
  if (blocked) return blocked;
  const raw = (await req.json()) as WidgetRequest;
  const body: WidgetRequest = { ...raw, title: clip(raw.title, 120), spec: clip(raw.spec, 3000), trajectory: (raw.trajectory ?? []).slice(0, 40) };
  try {
    return Response.json(await buildWidget(body));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

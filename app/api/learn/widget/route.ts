import { buildWidget } from "@/lib/learn/server";
import type { WidgetRequest } from "@/lib/learn/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json()) as WidgetRequest;
  try {
    return Response.json(await buildWidget(body));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

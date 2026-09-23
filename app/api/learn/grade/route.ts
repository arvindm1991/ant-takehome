import { grade } from "@/lib/learn/server";
import type { GradeRequest } from "@/lib/learn/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as GradeRequest;
  try {
    return Response.json(await grade(body));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

import { act } from "@/lib/learn/server";
import type { LearnRequest } from "@/lib/learn/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as LearnRequest;
  try {
    return Response.json({ actions: await act(body) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

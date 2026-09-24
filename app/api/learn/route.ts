import { act } from "@/lib/learn/server";
import { clip, guard } from "@/lib/rateLimit";
import type { LearnRequest } from "@/lib/learn/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const blocked = guard(req, "learn");
  if (blocked) return blocked;
  const raw = (await req.json()) as LearnRequest;
  const body: LearnRequest = {
    ...raw,
    userPrompt: clip(raw.userPrompt, 4000),
    trajectory: (raw.trajectory ?? []).slice(0, 40),
    feed: (raw.feed ?? []).slice(-30),
    event: raw.event?.type === "user_message" ? { ...raw.event, text: clip(raw.event.text, 2000) } : raw.event,
  };
  try {
    return Response.json({ actions: await act(body) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

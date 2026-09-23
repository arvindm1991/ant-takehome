import { classify } from "@/lib/learn/server";

export async function POST(req: Request) {
  const { prompt, known } = (await req.json()) as { prompt: string; known?: { id: string; label: string }[] };
  try {
    return Response.json(await classify(String(prompt ?? ""), Array.isArray(known) ? known.slice(0, 40) : []));
  } catch {
    return Response.json({ learnable: false, topics: [] });
  }
}

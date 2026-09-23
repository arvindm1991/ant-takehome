import { classify } from "@/lib/learn/server";

export async function POST(req: Request) {
  const { prompt } = (await req.json()) as { prompt: string };
  try {
    return Response.json(await classify(String(prompt ?? "")));
  } catch {
    return Response.json({ learnable: false, topics: [] });
  }
}

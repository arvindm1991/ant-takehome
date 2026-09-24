import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { buildMainRequest, type MainRequestInput } from "@/lib/main/request";
import { MainResultSchema, type MainEvent } from "@/lib/main/schema";
import { mockResponse } from "@/lib/main/mock";
import { guard } from "@/lib/rateLimit";
import { clip, publicError, readJson, UserFacingError } from "@/lib/api";

export const maxDuration = 300;

const encoder = new TextEncoder();
const line = (e: MainEvent) => encoder.encode(JSON.stringify(e) + "\n");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const blocked = guard(req, "main");
  if (blocked) return blocked;
  const raw = await readJson<MainRequestInput>(req);
  if (raw instanceof Response) return raw;
  if (!raw?.prompt || typeof raw.prompt !== "string") {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  const input: MainRequestInput = {
    prompt: clip(raw.prompt, 4000),
    history: (Array.isArray(raw.history) ? raw.history : [])
      .slice(-20)
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: clip(m.content, 4000) })),
  };
  const useMock = !process.env.ANTHROPIC_API_KEY || process.env.MOCK_MAIN === "1";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: MainEvent) => controller.enqueue(line(e));
      try {
        if (useMock) {
          const mock = mockResponse(input.prompt);
          for (const chunk of mock.thinking) {
            send({ type: "thinking", text: chunk });
            await sleep(mock.result.complexity === "trivial" ? 150 : 900);
          }
          send({ type: "result", result: mock.result, simulated: true });
        } else {
          await streamReal(input, send);
        }
      } catch (err) {
        send({ type: "error", message: publicError(err).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function streamReal(input: MainRequestInput, send: (e: MainEvent) => void) {
  const client = new Anthropic();
  const base = buildMainRequest(input);
  const params = {
    ...base,
    output_config: { effort: "medium" as const, format: betaZodOutputFormat(MainResultSchema) },
    // Server-side refusal fallbacks; set MAIN_FALLBACKS=off to disable.
    ...(process.env.MAIN_FALLBACKS === "off"
      ? {}
      : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  };

  const stream = client.beta.messages.stream(params);
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "thinking_delta") {
      send({ type: "thinking", text: event.delta.thinking });
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new UserFacingError("Claude declined this request.");
  if (final.stop_reason === "max_tokens") throw new UserFacingError("The response was too long and got cut off. Try a smaller task.");

  const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UserFacingError("Claude returned an unexpected response shape. Please try again.");
  }
  const parsed = MainResultSchema.safeParse(json);
  if (!parsed.success) throw new UserFacingError("Claude returned an unexpected response shape. Please try again.");
  send({ type: "result", result: parsed.data, simulated: false });
}

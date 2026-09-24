// Shared hardening for the model-calling API routes: bounded body parsing, deep
// clamping of client-supplied data, and error messages safe to show to users.
import Anthropic from "@anthropic-ai/sdk";

/** An error whose message is ours and safe to show to the user. */
export class UserFacingError extends Error {}

const MAX_BODY_BYTES = 256 * 1024;

/** Read and parse a JSON body, enforcing the size limit on the bytes actually sent (not Content-Length). */
export async function readJson<T>(req: Request, maxBytes = MAX_BODY_BYTES): Promise<T | Response> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return tooLarge();
  const reader = req.body?.getReader();
  if (!reader) return Response.json({ error: "Missing body." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return tooLarge();
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
}

/** Clamp a single client-supplied string before it reaches a model. */
export const clip = (s: unknown, max: number) => String(s ?? "").slice(0, max);

const tooLarge = () => Response.json({ error: "Request too large." }, { status: 413 });

/**
 * Bound every string and array in client-supplied data before any of it can reach a
 * prompt. Keeps worst-case prompt size (and cost) predictable regardless of shape.
 */
export function clampDeep<T>(value: T, opts = { maxString: 4000, maxArray: 40, maxDepth: 8 }, depth = 0): T {
  if (typeof value === "string") return value.slice(0, opts.maxString) as T;
  if (depth >= opts.maxDepth) return (Array.isArray(value) ? [] : typeof value === "object" && value ? {} : value) as T;
  if (Array.isArray(value)) return value.slice(-opts.maxArray).map((v) => clampDeep(v, opts, depth + 1)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value).slice(0, 50)) out[k] = clampDeep(v, opts, depth + 1);
    return out as T;
  }
  return value;
}

/** Map an error to a message safe for users; details go to server logs only. */
export function publicError(err: unknown): { message: string; status: number } {
  if (err instanceof UserFacingError) return { message: err.message, status: 502 };
  console.error("[api]", err);
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429 || err.status === 529) return { message: "Claude is busy right now. Please try again in a minute.", status: 503 };
    if (err.status === 401 || err.status === 403) return { message: "This demo's API access isn't working right now.", status: 503 };
    if (err.status === 400) return { message: "Claude couldn't process that request.", status: 502 };
  }
  return { message: "Something went wrong talking to Claude. Please try again.", status: 502 };
}

export const errorResponse = (err: unknown) => {
  const { message, status } = publicError(err);
  return Response.json({ error: message }, { status });
};

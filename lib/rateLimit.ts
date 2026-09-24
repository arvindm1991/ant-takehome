// Per-IP rate limits and a daily cap for the model-calling API routes.
//
// Prototype scope: counters live in memory, so on Vercel they are per serverless
// instance and reset on cold start. Production would back this with a shared store
// (e.g. Redis). Limits apply only when live model calls are possible (API key set).

export type BucketName = "main" | "learn" | "widget";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Per-IP requests per hour. A full learning session is ~10 learn calls and ≤ 1 widget. */
export function limits() {
  return {
    main: num(process.env.RATE_LIMIT_MAIN_PER_HOUR, 20),
    learn: num(process.env.RATE_LIMIT_LEARN_PER_HOUR, 150),
    widget: num(process.env.RATE_LIMIT_WIDGET_PER_HOUR, 10),
    daily: num(process.env.RATE_LIMIT_DAILY_TOTAL, 2000),
    // Expensive buckets (Opus, large outputs) get their own daily ceilings.
    mainDaily: num(process.env.RATE_LIMIT_MAIN_PER_DAY, 200),
    widgetDaily: num(process.env.RATE_LIMIT_WIDGET_PER_DAY, 60),
  };
}

type Daily = { day: number; total: number; main: number; widget: number; learn: number };
type Store = { hits: Map<string, number[]>; daily: Daily };
const freshDaily = (day: number): Daily => ({ day, total: 0, main: 0, widget: 0, learn: 0 });
const store: Store = { hits: new Map(), daily: freshDaily(0) };

export function resetRateLimits() {
  store.hits.clear();
  store.daily = freshDaily(0);
}

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number; reason: "ip" | "daily" };

/** Sliding one-hour window per IP and bucket, plus a global daily cap. Records the hit when allowed. */
export function hit(ip: string, bucket: BucketName, now = Date.now()): LimitResult {
  const l = limits();
  const today = Math.floor(now / DAY);
  if (store.daily.day !== today) store.daily = freshDaily(today);
  const bucketCap = bucket === "main" ? l.mainDaily : bucket === "widget" ? l.widgetDaily : Infinity;
  if (store.daily.total >= l.daily || store.daily[bucket] >= bucketCap) {
    return { ok: false, retryAfterSec: Math.ceil(((today + 1) * DAY - now) / 1000), reason: "daily" };
  }

  const key = `${bucket}:${ip}`;
  const recent = (store.hits.get(key) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= l[bucket]) {
    store.hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((recent[0] + HOUR - now) / 1000), reason: "ip" };
  }
  recent.push(now);
  store.hits.set(key, recent);
  store.daily.total++;
  store.daily[bucket]++;
  if (store.hits.size > 10_000) prune(now);
  return { ok: true };
}

function prune(now: number) {
  for (const [k, v] of store.hits) if (v.every((t) => now - t >= HOUR)) store.hits.delete(k);
}

// On Vercel, x-forwarded-for is set by the platform (client-supplied values are not
// passed through), so its first entry is the caller. Elsewhere, put a trusted proxy in front.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Rate-limit guard for a model-calling route (live mode only). Body size is enforced
 * separately by readJson (lib/api.ts). Returns an error Response to send, or null.
 */
export function guard(req: Request, bucket: BucketName): Response | null {
  if (!process.env.ANTHROPIC_API_KEY) return null; // mock mode: nothing to protect
  const r = hit(clientIp(req), bucket);
  if (r.ok) return null;
  const msg =
    r.reason === "daily"
      ? "This demo has reached its daily usage cap. Please try again tomorrow."
      : `You've hit this demo's rate limit. Try again in ${Math.ceil(r.retryAfterSec / 60)} min.`;
  return Response.json({ error: msg }, { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } });
}

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clientIp, guard, hit, resetRateLimits } from "./rateLimit";

const req = (headers: Record<string, string> = {}) => new Request("http://x/api/main", { method: "POST", headers });

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.RATE_LIMIT_MAIN_PER_HOUR = "3";
    process.env.RATE_LIMIT_DAILY_TOTAL = "5";
  });
  afterEach(() => {
    delete process.env.RATE_LIMIT_MAIN_PER_HOUR;
    delete process.env.RATE_LIMIT_DAILY_TOTAL;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("limits per IP within a sliding hour, independently per IP", () => {
    const t = 1_000_000_000_000;
    for (let i = 0; i < 3; i++) expect(hit("1.1.1.1", "main", t + i).ok).toBe(true);
    const blocked = hit("1.1.1.1", "main", t + 10);
    expect(blocked).toMatchObject({ ok: false, reason: "ip" });
    expect(hit("2.2.2.2", "main", t + 10).ok).toBe(true);
    expect(hit("1.1.1.1", "main", t + 60 * 60 * 1000 + 1).ok).toBe(true); // window slid
  });

  it("enforces a global daily cap across IPs", () => {
    const t = 1_000_000_000_000;
    for (let i = 0; i < 5; i++) expect(hit(`ip${i}`, "learn", t).ok).toBe(true);
    expect(hit("ip9", "learn", t)).toMatchObject({ ok: false, reason: "daily" });
  });

  it("uses the first forwarded IP", () => {
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });

  it("caps expensive buckets per day independently of the total", () => {
    process.env.RATE_LIMIT_DAILY_TOTAL = "100";
    process.env.RATE_LIMIT_WIDGET_PER_DAY = "2";
    const t = 1_000_000_000_000;
    expect(hit("a", "widget", t).ok).toBe(true);
    expect(hit("b", "widget", t).ok).toBe(true);
    expect(hit("c", "widget", t)).toMatchObject({ ok: false, reason: "daily" });
    expect(hit("c", "learn", t).ok).toBe(true);
    delete process.env.RATE_LIMIT_WIDGET_PER_DAY;
  });

  it("guard: no limiting in mock mode; 429 with Retry-After when live", async () => {
    for (let i = 0; i < 10; i++) expect(guard(req(), "main")).toBeNull(); // no key → mock
    process.env.ANTHROPIC_API_KEY = "test";
    for (let i = 0; i < 3; i++) expect(guard(req({ "x-forwarded-for": "3.3.3.3" }), "main")).toBeNull();
    const res = guard(req({ "x-forwarded-for": "3.3.3.3" }), "main")!;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()).error).toMatch(/rate limit/);
  });
});

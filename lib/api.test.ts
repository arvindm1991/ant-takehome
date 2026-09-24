import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { clampDeep, publicError, readJson, UserFacingError } from "./api";

const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request("http://x", { method: "POST", body, headers });

describe("readJson", () => {
  it("parses small bodies", async () => {
    expect(await readJson(post(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
  });
  it("rejects oversized bodies by bytes read, even without a Content-Length", async () => {
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 10; i++) c.enqueue(new TextEncoder().encode("x".repeat(50_000)));
        c.close();
      },
    });
    const r = await readJson(new Request("http://x", { method: "POST", body: stream, duplex: "half" } as RequestInit));
    expect((r as Response).status).toBe(413);
  });
  it("rejects invalid JSON with 400", async () => {
    expect(((await readJson(post("{nope"))) as Response).status).toBe(400);
  });
});

describe("clampDeep", () => {
  it("bounds strings, arrays and depth anywhere in the payload", () => {
    const out = clampDeep({ a: "x".repeat(10_000), list: Array.from({ length: 100 }, (_, i) => i), deep: { b: { c: "y".repeat(9000) } } });
    expect(out.a).toHaveLength(4000);
    expect(out.list).toHaveLength(40);
    expect(out.list[0]).toBe(60); // keeps the most recent items
    expect(out.deep.b.c).toHaveLength(4000);
  });
});

describe("publicError", () => {
  it("passes our own messages through and hides upstream details", () => {
    expect(publicError(new UserFacingError("The model declined this request.")).message).toBe("The model declined this request.");
    const upstream = new Anthropic.AuthenticationError(401, { error: { message: "invalid x-api-key" } }, "invalid x-api-key", new Headers());
    const pe = publicError(upstream);
    expect(pe.message).not.toMatch(/x-api-key/);
    expect(pe.status).toBe(503);
    expect(publicError(new SyntaxError("Unexpected token")).message).toMatch(/Something went wrong/);
  });
});

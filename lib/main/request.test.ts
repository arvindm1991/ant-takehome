import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMainRequest } from "./request";

// SPEC §7.1 — the main agent must never see learner state or learning-agent output.
describe("main agent isolation invariant", () => {
  it("builds a payload from the main thread only", () => {
    const req = buildMainRequest({
      prompt: "Build a login page",
      history: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });
    expect(Object.keys(req).sort()).toEqual(["max_tokens", "messages", "model", "system", "thinking"]);
    const text = JSON.stringify(req).toLowerCase();
    for (const banned of ["learn mode", "learner", "mastery", "misconception", "learning agent"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("lib/main never imports learning or memory modules", () => {
    const dir = __dirname;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/from ["']@\/lib\/(learn|memory)/);
    }
  });
});

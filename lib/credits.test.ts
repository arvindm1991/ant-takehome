import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { creditsExhausted, isOutOfCredits, resetCredits, withCreditFallback } from "./credits";

const apiError = (status: number, message: string) =>
  new Anthropic.APIError(status, { type: "error", error: { type: "invalid_request_error", message } }, message, new Headers());

describe("out-of-credits fallback", () => {
  beforeEach(resetCredits);
  it("recognises a credit-balance error, not other failures", () => {
    expect(isOutOfCredits(apiError(400, "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."))).toBe(true);
    expect(isOutOfCredits(apiError(400, "messages: at least one message is required"))).toBe(false);
    expect(isOutOfCredits(apiError(429, "rate limited"))).toBe(false);
    expect(isOutOfCredits(new Error("credit balance"))).toBe(false);
  });
  it("retries once on the scripted path and stays in mock mode", async () => {
    const fn = withCreditFallback(async () => {
      if (!creditsExhausted()) throw apiError(400, "Your credit balance is too low to access the Anthropic API.");
      return "scripted";
    });
    await expect(fn()).resolves.toBe("scripted");
    expect(creditsExhausted()).toBe(true);
  });
  it("passes other errors through", async () => {
    const fn = withCreditFallback(async () => {
      throw apiError(429, "rate limited");
    });
    await expect(fn()).rejects.toThrow();
    expect(creditsExhausted()).toBe(false);
  });
});

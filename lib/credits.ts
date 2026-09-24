// Scripted fallback when the API account runs out of credits. The first call that hits a
// credit-balance error flips this server instance into mock mode (reported by /api/status),
// and that call is retried on the scripted path so the user still gets an answer.
import Anthropic from "@anthropic-ai/sdk";

let exhausted = false;

export const creditsExhausted = () => exhausted;

export function isOutOfCredits(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError)) return false;
  const text = `${err.message} ${JSON.stringify(err.error ?? "")}`;
  return [400, 402, 403].includes(err.status ?? 0) && /credit balance|purchase credits|plans & billing|insufficient (credit|funds|balance)/i.test(text);
}

/**
 * Run `fn`; if the account is out of credits, remember that and run it again. Callers check
 * `creditsExhausted()` in their mock switch, so the second run takes the scripted path.
 */
export function withCreditFallback<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (exhausted || !isOutOfCredits(err)) throw err;
      exhausted = true;
      console.warn("[credits] API credits ran out: switching to the scripted fallback");
      return fn(...args);
    }
  };
}

/** Test hook. */
export function resetCredits() {
  exhausted = false;
}

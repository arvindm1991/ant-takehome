// Simulated agent pacing (SPEC D11). The full result is already in hand; we reveal
// steps at a speed resembling a real agent loop (tool calls, file writes).
import type { MainStep } from "@/lib/main/schema";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function revealDelayMs(step: MainStep): number {
  switch (step.kind) {
    case "read":
      return 1400;
    case "plan":
      return 2200;
    case "file":
      return clamp(1800 + step.content.length * 1.2, 2200, 6000);
    case "command":
      return 1800;
    case "note":
      return 1500;
    case "answer":
      return 0;
  }
}

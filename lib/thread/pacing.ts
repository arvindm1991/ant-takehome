// Simulated agent pacing (SPEC D11). The full result is already in hand; we reveal
// steps at a speed resembling a real agent loop (tool calls, file writes).
import type { MainStep } from "@/lib/main/schema";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function revealDelayMs(step: MainStep): number {
  switch (step.kind) {
    case "read":
      return 500;
    case "plan":
      return 800;
    case "file":
      return clamp(600 + step.content.length * 0.3, 800, 2000);
    case "command":
      return 600;
    case "note":
      return 500;
    case "answer":
      return 0;
  }
}

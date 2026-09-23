// Deterministic cross-check for "approach" MCQs (SPEC D14, D18): the answer key is
// the set of files the main agent actually chose to read.
import type { FeedEntry, TrajectoryItem, Verdict } from "./types";

export function crossCheckApproach(
  picked: string[],
  options: string[],
  trajectory: TrajectoryItem[],
): Pick<Extract<FeedEntry, { kind: "reveal" }>, "picked" | "actual" | "verdict"> {
  const reads = trajectory.filter((i) => i.kind === "read");
  const actual = reads.map((r) => ({ path: r.title, why: r.content, itemId: r.id }));
  const key = new Set(actual.map((a) => a.path).filter((p) => options.includes(p)));
  const hits = picked.filter((p) => key.has(p)).length;
  const wrong = picked.length - hits;
  let verdict: Verdict = "incorrect";
  if (hits > 0 && wrong === 0 && hits >= Math.min(2, key.size)) verdict = "correct";
  else if (hits > 0) verdict = "partial";
  return { picked, actual, verdict };
}

/** Reads are complete once the main agent moved past them (plan shown) or finished. */
export function readsComplete(trajectory: TrajectoryItem[], mainAgentDone: boolean): boolean {
  if (mainAgentDone) return true;
  return trajectory.some((i) => i.kind !== "read" && i.kind !== "reasoning" && i.kind !== "user_prompt" && i.revealed);
}

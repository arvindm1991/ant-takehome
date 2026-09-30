// Scripted checklists for the no-key / out-of-credits fallback, keyed on the task.
import type { ReviewCriterion, ReviewRequest } from "./types";

const pick = (files: string[], ...hints: string[]) => files.find((f) => hints.some((h) => f.includes(h))) ?? "";

export function mockChecklist(req: ReviewRequest): ReviewCriterion[] {
  const p = req.prompt.toLowerCase();
  const files = req.files.map((f) => f.path);
  if (/login|auth|jwt/.test(p))
    return [
      { text: "No secrets are hardcoded; the signing key comes from the environment", lookAt: pick(files, "auth", "env") },
      { text: "Passwords are hashed with a slow hash (bcrypt or similar), never stored or compared as plain text", lookAt: pick(files, "login", "auth") },
      { text: "The token is checked for signature, algorithm and expiry before anything trusts it", lookAt: pick(files, "auth") },
      { text: "The token lives where page scripts can't read it (an httpOnly cookie, not localStorage)", lookAt: pick(files, "login", "route") },
      { text: "Every notes page and API route is actually protected, not just the page you'd click first", lookAt: pick(files, "middleware") },
      { text: "The login screen is clear: helpful errors, a loading state, and it looks like the rest of the app", lookAt: pick(files, "page.tsx") },
    ];
  if (/sql|query|cohort|retention/.test(p))
    return [
      { text: "Cohorts are grouped by the month a user signed up, not by activity", lookAt: pick(files, ".sql") },
      { text: "Retention is a share of each cohort's size, so months can be compared", lookAt: pick(files, ".sql") },
      { text: "Users with no later activity still count in the cohort (no inner join drops them)", lookAt: pick(files, ".sql") },
      { text: "It would run in reasonable time on a large events table", lookAt: "" },
    ];
  if (/rate limit/.test(p))
    return [
      { text: "Limits apply per user or IP, so one attacker can't lock everyone out", lookAt: pick(files, "limit", "login") },
      { text: "Blocked requests get a clear 429 with a retry time", lookAt: pick(files, "login", "route") },
      { text: "Limits hold across server instances, or the gap is called out", lookAt: "" },
      { text: "Normal users logging in won't hit the limit", lookAt: "" },
    ];
  if (/debounce|search/.test(p))
    return [
      { text: "Typing fast sends one search after a pause, not one per key", lookAt: pick(files, "tsx", "ts") },
      { text: "A slow old response can't overwrite a newer one", lookAt: pick(files, "tsx", "ts") },
      { text: "The pending timer is cleared when the component goes away", lookAt: pick(files, "tsx", "ts") },
      { text: "Empty and no-result states make sense to someone using it", lookAt: "" },
    ];
  return [
    { text: "It does what you asked, with nothing important left out", lookAt: "" },
    { text: "It fits the way the rest of the codebase is written", lookAt: files[0] ?? "" },
    { text: "Errors and edge cases are handled, not just the happy path", lookAt: files[0] ?? "" },
    { text: "You could explain every change to a teammate", lookAt: "" },
  ];
}

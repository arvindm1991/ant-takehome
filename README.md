# Learn Mode — prototype

Education Labs take-home (Option B). A **learning sub-agent** rides alongside Claude's main agent inside regular Claude: it watches the main agent's work with read-only access and turns it into short, grounded learning moments, without interrupting or influencing the task.

- Design & decisions: [`SPEC.md`](SPEC.md)
- Test plan: [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)
- Status: **M5**: main agent (streamed reasoning + paced steps over a simulated repo); learning sub-agent (objectives → approach MCQ cross-checked against the agent's real reads → predict/explain-back → graded feedback with anchors → interactive widget + what-if → hint/retry → recap); learner memory (mastery, evidence, misconceptions, episodes) with a Progress view; spaced-repetition refreshers (simulated clock, Inbox, badge) and contextual nudges (direct recurrence, interleaving).

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for real model calls; leave empty for mock mode
npm run dev
```

Without an API key the app runs in **mock mode**: the auth-page and "capital of France" tasks return scripted responses through the same streaming pipeline.

## Checks

```bash
npm test        # unit: isolation invariant, mastery/SR math, MCQ cross-check, widget framing
npm run smoke   # browser journeys in mock mode (needs Playwright; see e2e/smoke.mjs)
npx eslint .
npm run build
```

## Deploy

Vercel: import the repo, set `ANTHROPIC_API_KEY` in project env vars. `/api/main` sets `maxDuration = 300`.

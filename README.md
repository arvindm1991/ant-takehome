# Learn Mode — prototype

Education Labs take-home (Option B). A **learning sub-agent** rides alongside Claude's main agent inside regular Claude: it watches the main agent's work with read-only access and turns it into short, grounded learning moments, without interrupting or influencing the task.

- Design & decisions: [`SPEC.md`](SPEC.md)
- Status: **M2**: main agent (streamed reasoning + paced steps over a simulated repo) and the learning sub-agent core loop (objectives → approach MCQ cross-checked against the agent's real reads → predict/explain-back → graded feedback with anchors → hint/what-if → recap). Memory, widgets and refreshers land in M3–M5.

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for real model calls; leave empty for mock mode
npm run dev
```

Without an API key the app runs in **mock mode**: the auth-page and "capital of France" tasks return scripted responses through the same streaming pipeline.

## Checks

```bash
npm test        # includes the main-agent isolation invariant (SPEC §7.1)
npx eslint .
npm run build
```

## Deploy

Vercel: import the repo, set `ANTHROPIC_API_KEY` in project env vars. `/api/main` sets `maxDuration = 300`.

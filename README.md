# Learn Mode — prototype

Education Labs take-home (Option B). A **learning sub-agent** rides alongside Claude's main agent inside regular Claude: it watches the main agent's work with read-only access and turns it into short, grounded learning moments, without interrupting or influencing the task.

- Design & decisions: [`SPEC.md`](SPEC.md)
- Status: **M1** (shell, simulated repo, main agent with streamed reasoning + paced steps). Learning agent lands in M2+.

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

# Learn Mode: shadow the chef, keep the skill

Education Labs take-home (Option B: *learning through collaboration with Claude*).

Learn Mode puts a **learning sub-agent** inside everyday Claude. While Claude's main agent does the work at full quality, the learning agent watches it (read-only) and turns it into short, grounded learning moments. Turn on **Learn mode** and it starts teaching from whatever Claude is working on. It never does the task. It opens with goal cards instead of a blank box, **shows before it asks** (interactive widgets built from Claude's code, like a visualizer for the JWT Claude's login issues), and has one text box of its own for answers and questions, with next moves as chips above it (*Dig deeper · Try it hands-on · Zoom out*, or *Hint · See how it works · Show me in Claude's code* after a miss):
- interactive widgets that mirror Claude's code: see the mechanism, then poke it
- an approach question while Claude is still orienting ("which files would you open first?"), checked against the files Claude actually reads
- predictions about the step Claude is about to write, graded against the code it actually writes
- a proactive check-in when Claude writes the step you predicted, and a recap of how your mastery moved
- hints, explanations and what-ifs that adapt to how you're doing
- a learner memory with mastery, evidence and misconceptions
- spaced-repetition and interleaving refreshers that bring topics back days later

The main agent never knows the learning agent exists, and the task never waits on you.

- **Prototype:** https://ant-takehome.vercel.app. Try *Build a login page with JWT auth for this app*, then click "Learn while Claude builds this" and pick a goal card.
- **Design and decisions:** [`SPEC.md`](SPEC.md) (numbered decision log, journeys, architecture, memory model, metrics)
- **Test plan:** [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) (includes the security and cost review) · **Eval strategy:** [`docs/EVAL_STRATEGY.md`](docs/EVAL_STRATEGY.md)

## What's live and what's simulated

The header badge in the app shows which mode a deployment is in; click it for the breakdown.

| Live Claude API calls (with `ANTHROPIC_API_KEY`) | Simulated for the prototype |
| --- | --- |
| Main agent: streamed reasoning summary + structured output (`claude-opus-5`) | Step pacing: the full result is revealed step by step, as a long agent run would be |
| Learning agent's teaching decisions (`claude-sonnet-5`, tool use) | The repository: a small fixture app (`lib/repo/acmeNotes.ts`); no files are written |
| Grader: verdict, misconception tag, where the answer is visible (`claude-sonnet-5`) | Time: a "+3 days" clock in the Inbox to show spaced repetition |
| Learnability check (`claude-haiku-4-5`), widget builder (`claude-opus-5`) | Learner memory and chats in browser storage (localStorage) |

Without a key, every model call falls back to a scripted mock covering the auth-page demo, through the same code paths.

## Run it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for live calls; leave empty for mock mode
npm run dev
```

Optional env vars (models, mock switches, rate limits) are documented in [`.env.example`](.env.example).

## Checks

```bash
npm test        # unit: isolation invariant, mastery/spaced-repetition math, MCQ cross-check, strategy, widget framing, rate limits
npm run smoke   # browser journeys in mock mode against a running build (needs Playwright; see e2e/smoke.mjs)
npx eslint . && npx tsc --noEmit && npm run build
```

## Code map

```
app/api/main            main agent: streams reasoning, returns structured steps (isolated: sees only the thread)
app/api/learn           learning agent: one decision per event, via teaching tools
app/api/learn/grade     rubric grader
app/api/learn/classify  learnability + topics + related known topics
app/api/learn/widget    interactive widget builder (HTML rendered in a sandboxed iframe)
app/api/status          what's live vs mocked on this deployment
lib/main                main-agent prompt, schema, mock (never imports lib/learn or lib/memory)
lib/learn               context assembly, tools, strategy, MCQ cross-check, mocks, widgets, client orchestration
lib/memory              learner memory: schema, mastery update, review schedule, refreshers, browser store
lib/thread              thread items with stable ids, pacing, persistence, anchor focus
lib/api.ts              bounded body parsing, deep clamping, user-safe errors
lib/rateLimit.ts        per-IP hourly limits, daily caps per bucket
components/             Claude-style shell, thread view, learning panel (Session / Your progress / Inbox)
```

## Deploy

Vercel: import the repo and set `ANTHROPIC_API_KEY`. Env var changes apply to new deployments.

Rate limits apply automatically when a key is set: per IP per hour, plus daily caps (in total, and separately for the Opus-backed main agent and widget builder). They're in memory, so each serverless instance counts separately and counters reset on cold start. That's fine for a demo; production would use a shared store and sign-in.

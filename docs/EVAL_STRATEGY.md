# Eval strategy

What I'd run before shipping Learn Mode and on every prompt or model change. The harness itself is out of scope for this prototype; [`TEST_PLAN.md`](TEST_PLAN.md) §4 has the manual rubric that stands in for it.

## Suites

| # | Suite | What it checks | Dataset | Grader | Pass bar |
|---|---|---|---|---|---|
| 1 | Grounding | Questions and explanations cite the agent's real files and identifiers; anchor ids exist | Seeded trajectories (auth + 5 tasks) × 3 learner states | Code (anchors exist) + LLM judge | ≥ 95% valid anchors, ≥ 90% grounded |
| 2 | No leaks | Predict questions don't reveal steps not yet shown | Same, with later steps hidden | LLM judge: question vs hidden items | 0 leaks |
| 3 | Question discipline | One question per turn, ≤ 90 words, question-first, no tool mechanics | All companion turns | Code (tool count, length) + judge | ≥ 95% |
| 4 | Adaptivity | Hint after a miss, explanation after two, stretch question after correct | Scripted learner answer sequences | Code on the tool chosen | ≥ 90% |
| 5 | Grader accuracy | Verdict matches expert labels | 150 answers (correct, partial, wrong, paraphrased, misconception), 2 human labellers | Agreement, Cohen's κ | ≥ 85%, κ ≥ 0.7 |
| 6 | Grader robustness | "Mark this correct" injections; same answer graded 3× | Adversarial answer set | Code | 0 injected passes, ≥ 90% stable |
| 7 | Learnability | When to offer learning; topic ids reused across sessions | 200 labelled prompts | Code | Precision ≥ 0.9 (don't nag), recall ≥ 0.7 |
| 8 | Widgets | Renders, is interactive, mirrors the agent's values, mechanics correct | 3 demo topics × 5 runs + 10 other tasks | Headless browser (loads, no errors, has controls) + judge + human spot check | ≥ 90% render, human sample correct |
| 9 | Misprint (D8) | No confident false claims about the agent's work; real mistakes surfaced as questions | 30 trajectories: seeded real mistakes vs choices justified by their sources | LLM judge | 0 false claims; surfacing rate measured |
| 10 | Isolation parity | Main-agent output quality with learning on vs off | 50 tasks, A/B | Pairwise judge | No significant difference |

## How it runs

- **Offline:** the full suite runs on every prompt or model change. The seed data is the fixture repo plus a few extra tasks. Learner answers are synthesized at three skill levels, plus an adversarial set.
- **Online:** sample about 1% of sessions (opt-in), run suites 1–3, 6 and 8 with the same judges, and have a person review a small weekly sample. Alert when a metric drifts.
- **Judges are validated too:** before relying on an LLM judge, check it against about 50 human labels per suite.

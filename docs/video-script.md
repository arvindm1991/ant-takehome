# Video script: Learn mode (target 7:30, hard limit 8:00)

The brief asks for a screenshare walkthrough of what you built, under 8 minutes, covering: the problem and solution, which option and why, the design and prototyping process, how it enhances rather than replaces agency, the learning principles, how you'd measure success, and how it scales. It also says they're assessing **your judgment in guiding Claude**, so segment 5 is built around the calls you made.

Narration is written to be spoken at about 140 words a minute. `[Brackets]` are what to show or do. Times are cumulative.

---

## Before you record

- **Use the live site** (API key set). The main agent takes 30 to 60 seconds and interactives are built live, so either keep recording and cut the waits, or prepare the later states in a second browser profile.
- **Tab A (fresh):** clear site data so memory is empty. Learn mode off. This is the main demo.
- **Tab B (prepared):** a finished JWT session, so the recap, *Your progress* and the Inbox after **+3 days** have something in them. Keep one refresher due.
- Window about 1440px wide. Close other tabs and notifications.
- Have the write-up open for the three images and the diagram.
- In live mode the goal cards and questions are written by the model, so wording will differ from this script. Pick the goal about checking the login token.

---

## 1. Opening · 0:00–0:25

`[Face cam or title: "Learn mode". Then the prototype, idle.]`

> Hi, I'm Arvind. This is Learn mode, my take on Option B. In one line: Claude does the work, and you learn from it while it happens. I'll cover the problem, show one real task, then how it works, the calls I made building it with Claude, and how it scales.


## 2. The problem, and why Option B · 0:25–1:35

`[Write-up: the brief quote, then the forklift and microwave images.]`

> The brief puts it well: when agents do complex work on their own, people become passive observers. Agents are a forklift in the gym and a microwave in the kitchen. The work gets done, but the muscle doesn't grow and the knives go dull. Showing more doesn't fix it; Claude already shows its work, and people skip to the answer.
>
> I chose B over A. A is customer education, teaching Claude's features. B is people getting better at their own work, and losing those skills is the bigger risk. It's also personal: I'm an aerospace engineer who built an award-winning edtech company, and I've stayed in education since.

`[Two-counters image.]`

> The other lesson from edtech: when something needs doing, people go to the counter that finishes the task. Many good learning products get little use; I've built some. So I put the learning inside Claude, where people already are, and it never makes the task wait.


## 3. Demo: one real task · 1:35–4:40

### Turn it on, give Claude a task · 1:35–2:05

`[Tab A. Point at the Learn mode switch in the top bar; mention the in-the-moment suggestion under a task and the refresher badge. Toggle Learn mode on. Panel opens: "Learn mode is on."]`

> There are three ways in: a switch that's always here, a suggestion in the moment under a task, and spaced review, which brings you back to what you learned before. Which mix works best is something we'd A/B test. When it's on, a learning agent runs next to Claude. Here's a real task: add JWT login to this notes app.

`[Send the "Build a login page with JWT auth" suggestion. Claude's reasoning starts streaming.]`

> Claude works exactly as it normally would. It doesn't know Learn mode exists, and it never waits for it.

### Goals from the task · 2:05–2:30

`[Goal cards appear.]`

> Instead of a blank chat box, Learn mode reads what Claude is doing and suggests what's worth learning: where login plugs into this repo, how the server checks a login token, why passwords use bcrypt. Anything I already know well is folded away. I'll pick the token one.

### Show first, then predict · 2:30–3:15

`[Interactive appears. Tap Header / Payload / Signature.]`

> It shows before it asks. This interactive is built from Claude's code: the token Claude's login will issue, in three parts. Anyone can decode the first two; only the signature needs the secret.

`[Point at the question; Claude hasn't written lib/auth.ts yet.]`

> Now it asks me to predict what `verifyToken()` has to check, before Claude has written it. It can do that because it reads Claude's plan and reasoning as they stream.

`[Type a partial answer, e.g. "check the signature". Submit. Feedback: "Partly there".]`

> It's graded against a key written from Claude's code, not a textbook.

### Where next, and the check-in · 3:15–4:00

`[Point at the chips: Hint · See how it works · Show me in Claude's code.]`

> Then I choose where to go: a hint, see how it works, which always builds an interactive, or Claude's code.

`[When the check-in appears: "Claude just wrote lib/auth.ts… check your prediction?" Click it; click the lib/auth.ts link, which scrolls Claude's thread to the line.]`

> This is the moment I care about most. Claude just wrote the file, so Learn mode checks in: here's what Claude did, against what I predicted, with a link straight to the line.

### One text box, its own · 4:00–4:20

`[Type in Learn mode's box: "add a logout button". Show the redirect.]`

> It has its own text box, styled apart from Claude's. Ask it to change the work, and it sends you back to Claude.

### It comes back · 4:20–4:40

`[Tab B: the recap with before → after bars. Inbox → +3 days → a refresher card.]`

> A recap shows what moved. Days later, or when related work comes up, the topic comes back as a one-question refresher. That's the third way in, and a growth loop: it brings people back, like a streak, and spaced repetition is one of the best ways to make learning stick.


## 4. How it works · 4:40–5:40

`[Write-up: the two-box diagram, then the tools table.]`

> There are two agents. Claude's main agent does the task, and nothing about the learner enters its context. The learning agent reads Claude's work and acts with tools: suggest goals, ask, build an interactive, hint, explain, wrap up. Everything it says points at a real step in Claude's work.
>
> Memory is built for learning. The model grades; plain code keeps the score, so it's consistent and checkable. Every attempt is kept as evidence, misconceptions stay open until you get them right without a hint, and topics come back at 1, 3, 7, 16 and 35 days. It all runs on the Claude API: Opus, Sonnet and Haiku, each where it fits.


## 5. How I got here, and the calls I made with Claude · 5:40–6:40

`[Write-up "How I got here", or the SPEC decision log.]`

> I built this with Claude, spec first: a decision log, then milestones. A few calls shaped it.
>
> Every model I brainstormed with, Claude included, suggested pausing the agent at key decisions so the user chooses. I rejected that: it makes the work only as good as the learner. The learner rides alongside; they don't steer.
>
> Then I kept testing the live build and pushing back. Claude's first panel was a chat box that felt like a second Claude. Next came goal cards and buttons, which felt like homework. So it now shows before it asks, has one text box of its own, and starts by itself when Learn mode is on. And "See how it works" always gets an interactive, set in code rather than left to the prompt.


## 6. Agency, learning, success, scale · 6:40–7:35

`[Write-up: "Keeping people in charge", the principles table, "Measuring success", "Scaling to millions".]`

> On agency: Claude still does the task fully, you choose what and how deep, everything can be dismissed, and Learn mode never does the task for you. Understanding Claude's choices is what lets you review them.
>
> The principles are simple: learn on the job, guess then check, do rather than watch, hints not answers, spaced review.
>
> Success is measured by first-try accuracy on refreshers, days later and in a different task: what stuck, not time spent. Guardrails: tasks take no longer, and people don't type requests for Claude into the wrong box.
>
> And it scales because it's not a new app. It's a switch, a nudge or a refresher in Claude and Claude Code, and we can A/B test which way in works for whom. Topics come from the work itself. On by default for students, a light suggestion for professionals, and cost follows use.


## 7. Close · 7:35–7:50

`[Back to the prototype, Learn mode panel open.]`

> That's Learn mode: Claude does the work, and you get better at it too. Everything's linked below. Thanks for watching.


---

**Total narration:** about 940 words, roughly 6 minutes spoken, which leaves about 1.5 minutes for demo actions and cut waits. If you run long, cut the "its own text box" beat (4:00–4:20) first, then trim segment 4 to the diagram only.

## Checklist against the brief

| Brief asks for | Where in the video |
|---|---|
| Screenshare walkthrough of what you built | 3 (demo), plus diagram in 4 |
| Problem and solution | 1–2, then 3 |
| Which option and why | 2 |
| Design and prototyping process | 5 |
| Enhances rather than replaces agency | 3 (Claude never waits; its own box), 6 |
| Learning principles | 3 (show first, predict, check), 4 (memory), 6 |
| How you'd measure success | 6 |
| Scaling to millions | 6 (switch in Claude and Claude Code; segments; cost) |
| Your judgment guiding Claude | 5 (rejected the pause-and-choose idea; iterations; set in code) |
| Specific journey, user segments, fits existing products | 3 (one auth task), 6 (students vs professionals), 2 and 6 (inside Claude) |

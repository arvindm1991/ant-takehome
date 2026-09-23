// Scripted learning-agent behaviour for mock mode (no API key). Mirrors what the real
// LSA is prompted to do for the primary demo (auth page), so the UI path is identical.
import type { GradeRequest, GradeResult, LearnAction, LearnRequest, Learnability, TrajectoryItem } from "./types";

const AUTH_RE = /auth|login|jwt|sign.?in/i;

export function mockLearnability(prompt: string): Learnability {
  if (AUTH_RE.test(prompt)) {
    return {
      learnable: true,
      topics: [
        { id: "jwt", label: "JWT auth" },
        { id: "password-hashing", label: "password hashing" },
        { id: "token-storage", label: "token storage" },
      ],
    };
  }
  if (/sql|rate.?limit|debounce/i.test(prompt)) {
    return { learnable: true, topics: [{ id: "general", label: prompt.split(" ").slice(0, 4).join(" ") }] };
  }
  return { learnable: false, topics: [] };
}

const find = (t: TrajectoryItem[], title: string) => t.find((i) => i.title === title)?.id;

let n = 0;
const pid = (tag: string) => `mock-${tag}-${n++}`;

const PREDICT: Record<string, { question: string; anchorTitle: string; rubric: string }> = {
  jwt: {
    question:
      "Claude is about to write `verifyToken()` in `lib/auth.ts`. Before it does: what must the server check on an incoming JWT before trusting it, and why?",
    anchorTitle: "lib/auth.ts",
    rubric: "Verify the signature with the server secret; check expiry (exp); pin the allowed algorithm (reject alg:none / confusion). The payload is only base64-encoded: readable, not secret.",
  },
  "password-hashing": {
    question:
      "Claude is about to write `hashPassword()`. Why not just store `sha256(password)`? What property should a password hash have?",
    anchorTitle: "lib/auth.ts",
    rubric: "Password hashes must be deliberately slow (cost factor, e.g. bcrypt 12) and salted, so brute force and rainbow tables are expensive; SHA-256 is fast.",
  },
  "token-storage": {
    question:
      "After login, where should the browser keep the token, and which attack does that choice defend against?",
    anchorTitle: "app/api/login/route.ts",
    rubric: "An httpOnly (Secure, SameSite) cookie: page JavaScript can't read it, which limits token theft via XSS; localStorage is readable by any script.",
  },
};

const WHAT_IF: Record<string, { question: string; anchorTitle: string; rubric: string }> = {
  jwt: {
    question: "What if `verifyToken()` checked the signature but skipped `exp`? What could an attacker do?",
    anchorTitle: "lib/auth.ts",
    rubric: "A stolen token would work forever; expiry limits the window of a leaked token. Mentions replay / indefinite validity.",
  },
  "password-hashing": {
    question: "Claude used cost factor 12. What happens to an attacker, and to your login endpoint, if you raise it to 16?",
    anchorTitle: "lib/auth.ts",
    rubric: "Each +1 doubles the work: 16 is ~16x slower for attackers but also for every login (seconds per request, DoS risk).",
  },
  "token-storage": {
    question: "The cookie is `SameSite=Lax`. What kind of attack does that help with, beyond XSS?",
    anchorTitle: "app/api/login/route.ts",
    rubric: "CSRF: the cookie isn't sent on cross-site POSTs, so other sites can't make authenticated requests.",
  },
};

export function mockAct(r: LearnRequest): LearnAction[] {
  const t = r.trajectory;
  const topic = r.objective?.topicId ?? "jwt";
  const probes = r.feed.filter((e) => e.kind === "action" && e.action.kind === "probe");
  const e = r.event;

  if (!AUTH_RE.test(r.userPrompt)) {
    return [{ kind: "explain", text: "_Mock mode:_ the scripted learning companion only covers the **auth page** task. Add an API key to run the real learning agent on any task.", topicId: "general", anchors: [] }];
  }

  switch (e.type) {
    case "session_start": {
      const mastered = new Set(r.learner.knownTopics.filter((k) => (k.estimate ?? 0) >= 0.9).map((k) => k.id));
      const objectives = [
            { topicId: "jwt", label: "How JWTs are signed and verified", why: "Claude's middleware trusts a token on every request. Know what makes that safe." },
            { topicId: "password-hashing", label: "Why bcrypt, not SHA-256", why: "Claude hashes passwords before storing them; the choice of hash matters." },
            { topicId: "token-storage", label: "Where the token lives (cookie vs localStorage)", why: "One line in the login route decides your XSS exposure." },
      ].filter((o) => !mastered.has(o.topicId));
      return [{ kind: "objectives", objectives: objectives.length ? objectives : [{ topicId: "refresh-rotation", label: "Refresh-token rotation (next level)", why: "You've got the basics down. This is what Claude listed as the follow-up." }] }];
    }
    case "objective_selected":
      return [
        {
          kind: "probe",
          id: pid("approach"),
          mode: "approach",
          format: "mcq",
          question:
            r.mainAgentStatus === "done"
              ? "Before you read Claude's changes: if you'd done this yourself, which files in acme-notes would you have opened first? Pick up to 3."
              : "While Claude gets oriented: which files in acme-notes would you open first before adding login? Pick up to 3.",
          options: ["package.json", "lib/db.ts", "app/api/notes/route.ts", "app/globals.css", "app/page.tsx", "public/logo.svg"],
          topicId: "codebase-orientation",
          anchors: [],
          rubric: "Dependencies (package.json), the user model (lib/db.ts), and what needs protecting (app/api/notes/route.ts).",
        },
      ];
    case "answer_submitted":
      return [coreProbe(r, topic)];
    case "answer_graded": {
      const last = probes.at(-1);
      const lastProbe = last?.kind === "action" && last.action.kind === "probe" ? last.action : null;
      // The approach question is a warm-up; always move on to the core question.
      if (lastProbe?.mode === "approach") return [coreProbe(r, topic)];
      if (e.verdict !== "correct") {
        const hinted = r.feed.some((f) => f.kind === "action" && f.action.kind === "hint");
        return hinted
          ? [{ kind: "explain", text: PREDICT[topic].rubric, topicId: topic, anchors: [find(t, PREDICT[topic].anchorTitle)].filter(Boolean) as string[] }]
          : [{ kind: "hint", text: hintFor(topic), topicId: topic, anchors: [] }];
      }
      if (lastProbe?.mode === "predict" || lastProbe?.mode === "explain_back") {
        const w = WHAT_IF[topic];
        return [{ kind: "probe", id: pid("whatif"), mode: "what_if", format: "free_text", question: w.question, options: [], topicId: topic, anchors: [find(t, w.anchorTitle)].filter(Boolean) as string[], rubric: w.rubric }];
      }
      return [{ kind: "end", recap: recapFor(topic) }];
    }
    case "user_message":
      return [{ kind: "explain", text: "Good question. Look at how Claude handled it in the code it wrote; the anchor shows the exact spot. _(Mock mode gives a generic answer; the real agent answers your question directly.)_", topicId: topic, anchors: [find(t, "lib/auth.ts")].filter(Boolean) as string[] }];
    case "main_agent_done":
      return [];
  }
}

// Before the code exists: predict. After: explain back (SPEC J2).
const EXPLAIN_BACK: Record<string, string> = {
  jwt: "Look at `verifyToken()` in `lib/auth.ts`. In your own words: what does it check before trusting a token, and why does each check matter?",
  "password-hashing": "Look at `hashPassword()` in `lib/auth.ts`. Why did Claude use bcrypt with cost 12 instead of `sha256(password)`?",
  "token-storage": "Look at how the login route stores the token. Why a cookie with those flags instead of localStorage?",
};

function coreProbe(r: LearnRequest, topic: string): LearnAction {
  const p = PREDICT[topic];
  const done = r.mainAgentStatus === "done";
  return {
    kind: "probe",
    id: pid(done ? "explain" : "predict"),
    mode: done ? "explain_back" : "predict",
    format: "free_text",
    question: done ? EXPLAIN_BACK[topic] : p.question,
    options: [],
    topicId: topic,
    anchors: [find(r.trajectory, p.anchorTitle)].filter(Boolean) as string[],
    rubric: p.rubric,
  };
}

function hintFor(topic: string) {
  return {
    jwt: "Think about what an attacker could change in a token, and what happens to a token that was stolen last week.",
    "password-hashing": "How many SHA-256 hashes per second can a modern GPU compute? What would you want that number to be?",
    "token-storage": "Which storage can page JavaScript read? Now imagine a script injected into the page.",
  }[topic] ?? "Look at the anchored step for a clue.";
}

function recapFor(topic: string) {
  return {
    jwt: "You can now explain what makes a JWT trustworthy: signature, pinned algorithm, and expiry. I'll check back on this in a few days.",
    "password-hashing": "You know why password hashes must be slow and salted, and the trade-off of the cost factor. I'll check back in a few days.",
    "token-storage": "You know why the token lives in an httpOnly, SameSite cookie and which attacks that blunts. I'll check back in a few days.",
  }[topic] ?? "Nice work.";
}

const KEYWORDS: Record<string, RegExp[]> = {
  jwt: [/sign/i, /exp|expir/i, /alg|algorithm|none/i, /secret|key/i],
  "password-hashing": [/slow|cost|work factor|rounds/i, /salt/i, /brute|rainbow|gpu|fast/i],
  "token-storage": [/httponly|http-only|cookie/i, /xss|script/i, /csrf|samesite/i],
};

const WHAT_IF_KEYWORDS: Record<string, RegExp[]> = {
  jwt: [/stolen|leak|steal/i, /forever|never expire|indefinite|replay|keeps? (working|access)/i],
  "password-hashing": [/slow|longer|16x|doubl/i, /login|user|server|dos|denial/i],
  "token-storage": [/csrf|cross.?site|forg/i, /request|post|other site/i],
};

export function mockGrade(g: GradeRequest): GradeResult {
  const kws = (g.probe.mode === "what_if" ? WHAT_IF_KEYWORDS : KEYWORDS)[g.probe.topicId] ?? [];
  const hits = kws.filter((k) => k.test(g.answer)).length;
  const verdict = hits >= 2 ? "correct" : hits === 1 ? "partial" : "incorrect";
  const anchor = g.probe.anchors[0] ?? g.trajectory.find((i) => i.kind === "file")?.id;
  const feedback =
    verdict === "correct"
      ? "Yes, that's the core of it. Compare your answer with what Claude actually wrote."
      : verdict === "partial"
        ? "You're partway there. You've got one key piece; there's at least one more thing that matters."
        : "Not quite. That misses what makes this safe.";
  return { verdict, misconceptionTag: verdict === "incorrect" ? `${g.probe.topicId}:core-property` : "", feedback, revealAnchors: anchor ? [anchor] : [] };
}

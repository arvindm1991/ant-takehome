// Scripted learning-agent behaviour for mock mode (no API key). Mirrors what the real
// LSA is prompted to do for the primary demo (auth page), so the UI path is identical.
import { MOCK_WIDGETS } from "./widgets/mock";
import type { GradeRequest, GradeResult, LearnAction, LearnRequest, Learnability, MoveKind, Objective, ProbeMode, TrajectoryItem } from "./types";

const RATE_RE = /rate.?limit/i;
const AUTH_RE = /^(?!.*rate.?limit).*(auth|login|jwt|sign.?in)/i;

export function mockLearnability(prompt: string): Learnability {
  if (RATE_RE.test(prompt)) {
    // Builds on the auth work: brute-forcing logins is exactly what bcrypt + rate limiting defend against.
    return { learnable: true, topics: [{ id: "rate-limiting", label: "rate limiting" }], relatedKnown: ["password-hashing", "jwt"] };
  }
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
  if (/sql|debounce/i.test(prompt)) {
    return { learnable: true, topics: [{ id: "general", label: prompt.split(" ").slice(0, 4).join(" ") }], relatedKnown: [] };
  }
  return { learnable: false, topics: [], relatedKnown: [] };
}

// ---------------------------------------------------------------- journey cards

export const MOCK_OBJECTIVES: Objective[] = [
  {
    topicId: "codebase-orientation",
    topicLabel: "Orienting in a codebase",
    kind: "orient",
    label: "Find where login plugs into this repo before Claude shows you",
    why: "Claude is opening files right now. Guess which ones, then compare.",
    minutes: 2,
    teaser: "Which 3 files would you open before adding login to a notes app?",
  },
  {
    topicId: "jwt",
    topicLabel: "JWT auth",
    kind: "core",
    label: "Explain what a server must check before it trusts a JWT",
    why: "Claude is about to write verifyToken() in lib/auth.ts.",
    minutes: 4,
  },
  {
    topicId: "password-hashing",
    topicLabel: "password hashing",
    kind: "core",
    label: "Tell a teammate why bcrypt beats SHA-256 for passwords",
    why: "Claude hashes every password before it touches lib/db.ts.",
    minutes: 3,
  },
  {
    topicId: "token-storage",
    topicLabel: "token storage",
    kind: "core",
    label: "Pick where a session token should live, and defend the choice",
    why: "One cookie flag in the login route decides your XSS exposure.",
    minutes: 3,
  },
  {
    topicId: "refresh-rotation",
    topicLabel: "refresh-token rotation",
    kind: "stretch",
    label: "Design refresh-token rotation so users stay signed in safely",
    why: "Claude's tokens expire in 15 minutes and it flagged rotation as the follow-up.",
    minutes: 6,
  },
];

// ---------------------------------------------------------------- topic content

type Q = { q: string; rubric: string; anchor: string; concept: string; deeper: string; sibling: string; mode: ProbeMode };
type TopicContent = {
  first: Q;
  deeper: Q;
  zoom: Q;
  easier: Q;
  challenge: Q;
  handsOn?: Q; // asked alongside the topic's widget
  hint: string;
  explain: { text: string; anchor: string; concept: string; deeper: string; sibling: string };
  showCode: { text: string; anchor: string };
  compare: string; // proactive check-in once Claude writes the predicted step
};

const q = (mode: ProbeMode, qText: string, rubric: string, anchor: string, concept: string, deeper: string, sibling: string): Q => ({ q: qText, rubric, anchor, concept, deeper, sibling, mode });

const CONTENT: Record<string, TopicContent> = {
  "codebase-orientation": {
    first: q("approach", "Which 3 files would you open before adding login to a notes app?", "package.json (dependencies), lib/db.ts (the user model), app/api/notes/route.ts (what needs protecting).", "", "Where login plugs in", "Middleware as a choke point", "Reading the data model"),
    deeper: q("predict", "Claude will add one check that protects every notes route. Where does a single check cover them all, and why there?", "In middleware: it runs before every matching route, so one check guards all protected paths instead of repeating it per route.", "middleware.ts", "Middleware as a choke point", "Route matchers", "Per-route guards"),
    zoom: q("explain_back", "Claude read `lib/db.ts` early. What did the User model tell it about what to build?", "User already has email and passwordHash, so Claude hashes and compares passwords instead of inventing a user model; notes have no owner yet.", "lib/db.ts", "Reading the data model", "Ownership checks", "Dependency audit"),
    easier: q("explain_back", "Which single file tells you the Next.js version and what libraries already exist?", "package.json lists dependencies and their versions.", "package.json", "Dependency audit", "Middleware as a choke point", "Reading the data model"),
    challenge: q("what_if", "You join a 200-file repo to add SSO. Name your first three reads and what each should tell you.", "Dependencies/config (package.json), existing auth/session code or middleware, and the user data model or schema.", "", "Orienting at scale", "Tracing a request", "Reading the data model"),
    hint: "Think in three questions: what's installed, what does a 'user' look like, and what needs protecting?",
    explain: { text: "Claude oriented in three moves: **dependencies** (`package.json`), the **data it builds on** (`lib/db.ts` already has `passwordHash`), and the **surface to protect** (`app/api/notes`). Versions → data → surface is a habit that works in any repo.", anchor: "package.json", concept: "Where login plugs in", deeper: "Middleware as a choke point", sibling: "Reading the data model" },
    showCode: { text: "Claude's reads say it: `lib/db.ts` already defines `passwordHash`, so the plan builds on the existing User model instead of inventing one.", anchor: "lib/db.ts" },
    compare: "Claude put the guard in `middleware.ts` with a matcher for `/notes/:path*` and `/api/notes/:path*`: one choke point for every protected route. Compare that with where you said you'd put it.",
  },
  jwt: {
    first: q("predict", "Claude is about to write `verifyToken()` in `lib/auth.ts`. Before it does: what must the server check on an incoming JWT before trusting it, and why?", "Verify the signature with the server secret; check expiry (exp); pin the allowed algorithm (reject alg none). The payload is only base64: readable, not secret.", "lib/auth.ts", "JWT verification", "HMAC signatures", "Token expiry"),
    deeper: q("predict", "`verifyToken()` recomputes the signature with `JWT_SECRET`. Why can't an attacker who edits the payload just recompute it too?", "The HMAC signature needs the secret key; without JWT_SECRET they can't produce a valid signature over the edited header and payload.", "lib/auth.ts", "HMAC signatures", "Secret rotation", "Asymmetric keys (RS256)"),
    zoom: q("what_if", "What if `verifyToken()` checked the signature but skipped `exp`? What could someone with a stolen token do?", "A stolen token would work forever; expiry limits how long a leaked token can be replayed.", "lib/auth.ts", "Token expiry", "Refresh tokens", "Revocation"),
    easier: q("explain_back", "True or false, and why: anyone who gets a JWT can read what's inside it.", "True: the payload is base64-encoded, readable, not encrypted; the signature prevents tampering, not reading.", "lib/auth.ts", "What a JWT hides (nothing)", "HMAC signatures", "Token expiry"),
    challenge: q("what_if", "Claude pinned `algorithms: [\"HS256\"]`. What attack does that stop if it were missing?", "Algorithm confusion or alg none: an attacker sets alg to none or switches algorithms so the server accepts an unsigned or forged token.", "lib/auth.ts", "Algorithm pinning", "Key management", "Token expiry"),
    handsOn: q("what_if", "Use the lab: set the attacker to **edit the payload** and make yourself admin, then try **alg: none**. Which check stops each attack in Claude's `verifyToken()`?", "Editing the payload breaks the signature (HMAC with the secret); alg none is rejected because the algorithm is pinned to HS256.", "lib/auth.ts", "Tampering in practice", "HMAC signatures", "Algorithm pinning"),
    hint: "Think about what an attacker could change in a token, and what happens to a token that was stolen last week.",
    explain: { text: "A JWT is three base64 parts: header, payload, signature. Anyone can **read** the payload. What makes it trustworthy is the **signature**: Claude's `verifyToken()` recomputes it with `JWT_SECRET`, **pins** `HS256`, and rejects anything past `exp`.", anchor: "lib/auth.ts", concept: "JWT verification", deeper: "HMAC signatures", sibling: "Token expiry" },
    showCode: { text: "The answer is one line in `lib/auth.ts`: `jwtVerify(token, secret, { algorithms: [\"HS256\"] })` checks the signature against the secret, pins the algorithm, and rejects an expired `exp`.", anchor: "lib/auth.ts" },
    compare: "Claude's `verifyToken()` does three things: checks the **signature** with `JWT_SECRET`, **pins** the algorithm to HS256, and rejects expired tokens via `exp`. Which of the three did your prediction cover?",
  },
  "password-hashing": {
    first: q("predict", "Claude is about to write `hashPassword()`. Why not just store `sha256(password)`? What property should a password hash have?", "Password hashes must be deliberately slow (a cost factor, like bcrypt 12) and salted, so brute force and rainbow tables are expensive; SHA-256 is fast.", "lib/auth.ts", "Password hashing", "Cost factor", "Salting"),
    deeper: q("what_if", "Claude used cost factor 12. What happens to an attacker, and to your own login endpoint, if you raise it to 16?", "Each +1 doubles the work: 16 is about 16x slower for attackers but also for every login, which risks slow logins and denial of service.", "lib/auth.ts", "Cost factor", "Tuning for hardware", "Salting"),
    zoom: q("explain_back", "bcrypt stores a random salt with each hash. What attack does the salt defeat?", "Precomputed rainbow tables; identical passwords get different hashes, so each one must be cracked separately.", "lib/auth.ts", "Salting", "Peppering", "Cost factor"),
    easier: q("explain_back", "Which is faster to compute, SHA-256 or bcrypt at cost 12? Which one do you want for passwords, and why?", "SHA-256 is much faster; for passwords you want the slow one (bcrypt) because slowness makes brute force expensive.", "lib/auth.ts", "Fast vs slow hashes", "Cost factor", "Salting"),
    challenge: q("what_if", "An attacker steals your users table. When does bcrypt cost 12 still protect users, and when doesn't it?", "It slows offline guessing so strong passwords survive; weak or common passwords still fall quickly, and it can't help if passwords were logged or reused elsewhere.", "lib/auth.ts", "Limits of hashing", "Password policy", "Salting"),
    handsOn: q("what_if", "Drag the cost from 12 to 16 in the explorer. What happens to the attacker, and what happens to your own login endpoint?", "Each +1 doubles the work: about 16x slower for attackers but also for every login (seconds per request, denial of service risk).", "lib/auth.ts", "Cost factor in practice", "Tuning for hardware", "Salting"),
    hint: "How many SHA-256 hashes per second can a modern GPU compute? What would you want that number to be?",
    explain: { text: "Fast hashes are great for files and terrible for passwords: a GPU can try billions of SHA-256 guesses a second. Claude's `hashPassword()` uses **bcrypt with cost 12** (about 250 ms per hash) and a **built-in salt**, so every guess is expensive and identical passwords look different.", anchor: "lib/auth.ts", concept: "Password hashing", deeper: "Cost factor", sibling: "Salting" },
    showCode: { text: "Look at `hashPassword()` in `lib/auth.ts`: `bcrypt.hash(password, 12)`. The `12` is the cost factor; bcrypt generates and stores the salt for you.", anchor: "lib/auth.ts" },
    compare: "Claude wrote `bcrypt.hash(password, 12)`: slow on purpose (cost 12), salted automatically. Did your prediction name both **slowness** and **salting**?",
  },
  "token-storage": {
    first: q("predict", "After login, where should the browser keep the token, and which attack does that choice defend against?", "An httpOnly (Secure, SameSite) cookie: page JavaScript can't read it, which limits token theft via XSS; localStorage is readable by any script.", "app/api/login/route.ts", "Token storage", "SameSite and CSRF", "XSS"),
    deeper: q("what_if", "The cookie is `SameSite=Lax`. What kind of attack does that help with, beyond XSS, and how?", "CSRF: the cookie isn't sent on cross-site POSTs, so other sites can't make authenticated requests.", "app/api/login/route.ts", "SameSite and CSRF", "CSRF tokens", "XSS"),
    zoom: q("what_if", "httpOnly keeps scripts from reading the cookie. What can an injected script still do while the page is open?", "Make requests as the user (the cookie is sent automatically) and read page data; httpOnly limits theft, not all XSS damage.", "app/api/login/route.ts", "XSS", "Content Security Policy", "SameSite and CSRF"),
    easier: q("explain_back", "Can JavaScript on the page read an httpOnly cookie? Why does that matter?", "No; it protects the token from being stolen by an XSS script.", "app/api/login/route.ts", "httpOnly", "SameSite and CSRF", "XSS"),
    challenge: q("what_if", "Your mobile app can't use cookies easily. Where does the token go, and what do you give up?", "Secure platform storage (keychain) sent as a bearer header; you lose automatic httpOnly protection, so theft matters more and short expiry becomes more important.", "app/api/login/route.ts", "Tokens beyond the browser", "Bearer tokens", "XSS"),
    handsOn: q("what_if", "Try both attacks against Claude's httpOnly cookie. XSS is limited, but what does `SameSite=Lax` protect against, and how?", "CSRF: the cookie isn't sent on cross-site POSTs, so other sites can't make authenticated requests.", "app/api/login/route.ts", "Attacks in practice", "SameSite and CSRF", "XSS"),
    hint: "Which storage can page JavaScript read? Now imagine a script injected into the page.",
    explain: { text: "Claude's login route sets the token as a cookie with **httpOnly** (scripts can't read it), **Secure** (HTTPS only) and **SameSite=Lax** (not sent on cross-site POSTs). That blunts token theft via XSS and most CSRF, which localStorage can't do.", anchor: "app/api/login/route.ts", concept: "Token storage", deeper: "SameSite and CSRF", sibling: "XSS" },
    showCode: { text: "In `app/api/login/route.ts`: `cookies().set(SESSION_COOKIE, token, { httpOnly: true, secure: …, sameSite: \"lax\" })`. Each flag closes one attack.", anchor: "app/api/login/route.ts" },
    compare: "Claude stored the token as an **httpOnly, SameSite=Lax** cookie in the login route. Did your prediction pick the same place, and name the attack it stops?",
  },
  "refresh-rotation": {
    first: q("predict", "Claude's tokens last 15 minutes. Sketch how a refresh token keeps users signed in without making a stolen token last longer.", "A long-lived refresh token (httpOnly) is exchanged for a new short access token; rotate the refresh token on each use and revoke on reuse.", "app/api/login/route.ts", "Refresh-token rotation", "Reuse detection", "Session revocation"),
    deeper: q("what_if", "Rotation issues a new refresh token on every use. How does that let you detect a stolen refresh token?", "If an old refresh token is used again, that's reuse: someone else has it, so revoke the whole token family and force re-login.", "app/api/login/route.ts", "Reuse detection", "Token families", "Session revocation"),
    zoom: q("what_if", "How would you log a user out everywhere when JWTs are stateless?", "Revoke refresh tokens (server-side list or token version in the database) and keep access tokens short so they die quickly; or a denylist.", "lib/auth.ts", "Session revocation", "Token versioning", "Reuse detection"),
    easier: q("explain_back", "Why not just make the access token last 30 days?", "A stolen token would stay valid for 30 days and can't easily be revoked; short tokens limit the damage.", "lib/auth.ts", "Short-lived tokens", "Refresh-token rotation", "Session revocation"),
    challenge: q("what_if", "Design it: where does each token live, which endpoint rotates, and what happens on reuse?", "Access token short-lived (cookie or memory), refresh token httpOnly cookie scoped to a /refresh endpoint that rotates and stores the new one server-side; reuse revokes the family.", "app/api/login/route.ts", "Rotation design", "Reuse detection", "Session revocation"),
    hint: "What if the long-lived token changed every time it was used? What would it mean to see an old one again?",
    explain: { text: "Claude's access tokens expire in 15 minutes, which limits damage but logs people out. A **refresh token** (long-lived, httpOnly) buys new access tokens. **Rotation** swaps it on every use, so a reused old one reveals theft.", anchor: "app/api/login/route.ts", concept: "Refresh-token rotation", deeper: "Reuse detection", sibling: "Session revocation" },
    showCode: { text: "Claude's follow-up note flags it: tokens expire after 15 minutes (`maxAge: 60 * 15` in the login route), and refresh-token rotation is listed as the next step.", anchor: "app/api/login/route.ts" },
    compare: "Claude kept access tokens at 15 minutes and deferred rotation. Your design is the missing half: check it covers where the refresh token lives and what happens on reuse.",
  },
};

const REFRESH: Record<string, { question: string; anchorTitle: string; rubric: string }> = {
  jwt: {
    question: "Quick check from last time: a teammate says “JWT payloads are encrypted, so it's safe to put the user's role in there.” What's wrong with that, and what actually stops someone changing the role?",
    anchorTitle: "lib/auth.ts",
    rubric: "Payload is only base64 (readable, not encrypted); the signature (HMAC with the server secret) is what prevents tampering; verification rejects edited tokens.",
  },
  "password-hashing": {
    question: "Quick check: your hashes leak. Why does it matter that Claude chose bcrypt over SHA-256, in one or two sentences?",
    anchorTitle: "lib/auth.ts",
    rubric: "bcrypt is deliberately slow (cost factor) and salted, so offline brute force is far more expensive than fast SHA-256.",
  },
  "token-storage": {
    question: "Quick check: why is the session token in an httpOnly cookie instead of localStorage?",
    anchorTitle: "app/api/login/route.ts",
    rubric: "httpOnly cookies can't be read by page scripts, limiting token theft via XSS; localStorage is readable by any script.",
  },
  "codebase-orientation": {
    question: "Quick check: you're dropped into an unfamiliar repo to add a feature. Which three things do you look at before writing code, and why?",
    anchorTitle: "package.json",
    rubric: "Dependencies/framework version (package.json), the data model (e.g. lib/db.ts), and the code the change touches or must protect (e.g. routes/API).",
  },
};

const INTERLEAVE: Record<string, { question: string; rubric: string }> = {
  "password-hashing": {
    question: "Claude is adding rate limiting to login. You learned bcrypt makes each guess slow. Why do you still need rate limiting on `/api/login` if passwords are bcrypt-hashed?",
    rubric: "bcrypt slows offline cracking of stolen hashes; rate limiting stops online guessing against the live endpoint (and protects the server from the CPU cost of bcrypt per attempt).",
  },
  jwt: {
    question: "Claude is rate-limiting login. Once a user has a valid JWT, does rate limiting the login endpoint protect the rest of the API? Why or why not?",
    rubric: "No: tokens are verified per request by middleware; rate limiting login only limits credential guessing. Other endpoints need their own limits.",
  },
};

const FILE_QUIZ: Record<string, { q: string; rubric: string }> = {
  "middleware.ts": { q: "Claude's middleware matches `/notes` and `/api/notes`. What happens to an API request with an expired token, and what happens to a page visit?", rubric: "API request gets 401 Unauthorized JSON; a page visit is redirected to /login with next param." },
  "app/api/login/route.ts": { q: "Why does Claude's login route return the same error for an unknown email and a wrong password?", rubric: "So attackers can't tell which emails exist (no account enumeration)." },
  "app/login/page.tsx": { q: "After a successful login, where does the page send the user, and why keep a `next` parameter?", rubric: "It redirects to the next param (the page they wanted) or /notes, so users land where they were headed." },
  "lib/auth.ts": { q: "In `lib/auth.ts`, which function would you change to make sessions last an hour instead of 15 minutes?", rubric: "signToken via TOKEN_TTL (setExpirationTime) and the cookie maxAge in the login route." },
  ".env.example": { q: "Claude added `JWT_SECRET` to `.env.example`. What goes wrong if the secret is short or committed to git?", rubric: "Anyone with the secret can forge valid tokens; a short secret can be brute-forced; committed secrets leak." },
};

// ---------------------------------------------------------------- the act loop

const find = (t: TrajectoryItem[], title: string) => (title ? t.find((i) => i.title === title && i.kind !== "read")?.id ?? t.find((i) => i.title === title)?.id : undefined);

let n = 0;
const pid = (tag: string) => `mock-${tag}-${n++}`;

// Where "Dig deeper" and "Zoom out" will actually go next, so button labels always match.
const nextDeeper = (r: LearnRequest, topic: string, now: string) => (now === "deeper" || asked(r, "deeper", topic) ? "challenge" : "deeper");
const nextSibling = (r: LearnRequest, topic: string, now: string) => (now === "zoom" || asked(r, "zoom", topic) ? "easier" : "zoom");

function probe(r: LearnRequest, topic: string, tag: string, x: Q): LearnAction {
  const c = CONTENT[topic];
  const trail = c ? { deeper: c[nextDeeper(r, topic, tag)].concept, sibling: c[nextSibling(r, topic, tag)].concept } : { deeper: x.deeper, sibling: x.sibling };
  return {
    kind: "probe",
    id: pid(`${tag}-${topic}`),
    mode: x.mode,
    format: "free_text",
    question: x.q,
    options: [],
    topicId: topic,
    anchors: [find(r.trajectory, x.anchor)].filter(Boolean) as string[],
    rubric: x.rubric,
    concept: x.concept,
    ...trail,
  };
}

const asked = (r: LearnRequest, tag: string, topic: string) =>
  r.feed.some((e) => e.kind === "action" && e.action.kind === "probe" && e.action.id.startsWith(`mock-${tag}-${topic}-`));

const usedWidget = (r: LearnRequest) => r.feed.some((e) => e.kind === "action" && e.action.kind === "demonstrate");

function explain(r: LearnRequest, topic: string, text: string, anchor: string, trail?: { concept: string; deeper: string; sibling: string }): LearnAction {
  const c = CONTENT[topic];
  const next = c ? { deeper: c[nextDeeper(r, topic, "")].concept, sibling: c[nextSibling(r, topic, "")].concept } : {};
  return { kind: "explain", text, topicId: topic, anchors: [find(r.trajectory, anchor)].filter(Boolean) as string[], ...(trail ? { concept: trail.concept } : {}), ...next };
}

function firstMove(r: LearnRequest, topic: string, c: TopicContent): LearnAction {
  if (topic === "codebase-orientation") {
    return {
      kind: "probe",
      id: pid(`first-${topic}`),
      mode: "approach",
      format: "mcq",
      question:
        r.mainAgentStatus === "done"
          ? "Before you read Claude's changes: if you'd done this yourself, which files in acme-notes would you have opened first? Pick up to 3."
          : "Which 3 files would you open before adding login to a notes app? Pick up to 3, then watch where Claude actually looks.",
      options: ["package.json", "lib/db.ts", "app/api/notes/route.ts", "app/globals.css", "app/page.tsx", "public/logo.svg"],
      topicId: topic,
      anchors: [],
      rubric: c.first.rubric,
      concept: c.first.concept,
      deeper: c.first.deeper,
      sibling: c.first.sibling,
    };
  }
  // Before the code exists: predict. After: explain it back.
  const x = r.mainAgentStatus === "done" && c.first.mode === "predict" ? { ...c.first, mode: "explain_back" as const, q: c.first.q.replace(/^Claude is about to write/, "Look at how Claude wrote").replace(/Before it does: /, "") } : c.first;
  return probe(r, topic, "first", x);
}

function onMove(r: LearnRequest, topic: string, c: TopicContent, move: MoveKind): LearnAction[] {
  const widget = MOCK_WIDGETS[topic];
  switch (move) {
    case "dig_deeper":
    case "keep_going": {
      const k = nextDeeper(r, topic, "");
      return [probe(r, topic, k, c[k])];
    }
    case "zoom_out": {
      const k = nextSibling(r, topic, "");
      return [probe(r, topic, k, c[k])];
    }
    case "easier":
      return [probe(r, topic, "easier", c.easier)];
    case "challenge":
      return [probe(r, topic, "challenge", c.challenge)];
    case "hint":
      return [{ kind: "hint", text: c.hint, topicId: topic, anchors: [] }];
    case "show_code":
      return [explain(r, topic, c.showCode.text, c.showCode.anchor)];
    case "explain":
      return [explain(r, topic, c.explain.text, c.explain.anchor, c.explain)];
    case "hands_on":
    case "show":
      if (widget && c.handsOn && !usedWidget(r)) {
        return [
          { kind: "demonstrate", id: pid("widget"), title: widget.title, spec: widget.spec, topicId: topic, anchors: [find(r.trajectory, c.handsOn.anchor)].filter(Boolean) as string[], concept: c.handsOn.concept, deeper: c.handsOn.deeper, sibling: c.handsOn.sibling },
          probe(r, topic, "handson", c.handsOn),
        ];
      }
      return move === "show" ? [explain(r, topic, c.showCode.text, c.showCode.anchor)] : [probe(r, topic, "challenge", c.challenge)];
    case "quiz": {
      const next = (["deeper", "zoom", "easier", "challenge"] as const).find((k) => !asked(r, k, topic)) ?? "challenge";
      return [probe(r, topic, next, c[next])];
    }
  }
}

export function mockAct(r: LearnRequest): LearnAction[] {
  const e = r.event;
  const topic = r.objective?.topicId && CONTENT[r.objective.topicId] ? r.objective.topicId : "jwt";
  const c = CONTENT[topic];

  if (e.type === "refresher_start") return [refresherProbe(r, e.topicId, e.interleaveWith)];
  if ((r.sessionTrigger === "refresher" || r.sessionTrigger === "contextual") && e.type === "answer_graded") {
    return [{ kind: "end", recap: e.verdict === "correct" ? "Still solid. Next check-in will be further out." : "Worth another look. I'll bring this back sooner." }];
  }

  if (!AUTH_RE.test(r.userPrompt) && r.sessionTrigger !== "refresher" && r.sessionTrigger !== "contextual") {
    return [{ kind: "explain", text: "_Mock mode:_ the scripted mentor only covers the **auth page** task. Add an API key to run the real learning agent on any task.", topicId: "general", anchors: [] }];
  }

  switch (e.type) {
    case "session_start":
      return [{ kind: "objectives", objectives: MOCK_OBJECTIVES }];
    case "objective_selected":
      return [firstMove(r, topic, c)];
    case "answer_submitted":
      // Pre-emption continues while the approach cross-check waits for Claude's reads.
      return [probe(r, topic, "deeper", c.deeper)];
    case "answer_graded":
      return [{ kind: "end", recap: recapFor(topic) }];
    case "move":
      return onMove(r, topic, c, e.move);
    case "step_revealed": {
      if (e.probeId) return [explain(r, topic, c.compare, e.itemTitle)];
      const fq = FILE_QUIZ[e.itemTitle] ?? { q: `In one sentence: what does \`${e.itemTitle}\` do in the login flow?`, rubric: `${e.itemTitle} purpose role login flow` };
      return [probe(r, topic, "step", { ...c.first, q: fq.q, rubric: fq.rubric, anchor: e.itemTitle, mode: "explain_back" })];
    }
    case "user_message":
      return [explain(r, topic, `Good question. Here's the short version, grounded in what Claude wrote: ${c.explain.text} _(Mock mode gives a scripted answer; the live mentor answers your exact question.)_`, c.explain.anchor, c.explain)];
    case "main_agent_done":
      return [];
  }
}

function refresherProbe(r: LearnRequest, topicId: string, interleaveWith: string | null): LearnAction {
  const il = interleaveWith ? INTERLEAVE[topicId] : undefined;
  const x = REFRESH[topicId] ?? REFRESH.jwt;
  return {
    kind: "probe",
    id: pid(il ? "interleave" : "refresh"),
    mode: il ? "what_if" : "explain_back",
    format: "free_text",
    question: il ? il.question : x.question,
    options: [],
    topicId,
    anchors: [find(r.trajectory, x.anchorTitle)].filter(Boolean) as string[],
    rubric: il ? il.rubric : x.rubric,
    concept: CONTENT[topicId]?.first.concept ?? topicId,
    deeper: CONTENT[topicId]?.first.deeper ?? "",
    sibling: CONTENT[topicId]?.first.sibling ?? "",
  };
}

function recapFor(topic: string) {
  return (
    {
      "codebase-orientation": "You can orient in an unfamiliar repo: dependencies, data model, then the surface to protect, and why one middleware check guards it all.",
      jwt: "You can explain what makes a JWT trustworthy: signature, pinned algorithm and expiry, and why the payload is readable.",
      "password-hashing": "You know why password hashes must be slow and salted, and the trade-off of the cost factor.",
      "token-storage": "You know why the token lives in an httpOnly, SameSite cookie and which attacks that does and doesn't stop.",
      "refresh-rotation": "You can sketch refresh-token rotation and how reuse detection catches a stolen token.",
    }[topic] ?? "Nice work."
  );
}

// ---------------------------------------------------------------- grading

const STOP = new Set("about after again against because before being between could does doesn every from have into just make more most much only other over same should since some such than that their them then there these they this those through under very what when where which while will with would your".split(" "));
const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(ing|ed|es|s)$/, "");
const keywords = (text: string) => [...new Set(text.split(/\W+/).filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase())).map(stem))];

/** Mock grader: overlap between the answer and the rubric's key terms. */
export function mockGrade(g: GradeRequest): GradeResult {
  const key = keywords(g.probe.rubric);
  const said = new Set(keywords(g.answer));
  const hits = key.filter((k) => said.has(k)).length;
  const verdict = hits >= 3 || (key.length > 0 && hits / key.length >= 0.4 && hits >= 2) ? "correct" : hits >= 1 ? "partial" : "incorrect";
  const anchor = g.probe.anchors[0] ?? g.trajectory.find((i) => i.kind === "file")?.id;
  const feedback =
    verdict === "correct"
      ? "Yes, that's the core of it. Compare your answer with what Claude actually wrote."
      : verdict === "partial"
        ? "You're partway there: one key piece is right, and there's at least one more thing that matters."
        : "Not quite. That misses what makes this work.";
  return { verdict, misconceptionTag: verdict === "incorrect" ? `${g.probe.topicId}:core-idea` : "", feedback, revealAnchors: anchor ? [anchor] : [] };
}

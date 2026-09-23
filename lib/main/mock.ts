// Mock main-agent responses used when no ANTHROPIC_API_KEY is configured.
// Same event protocol as the real call, so the UI path is identical.
import type { MainResult } from "./schema";

const AUTH_THINKING = [
  "The user wants a login page with JWT auth in their existing acme-notes Next.js app. ",
  "Let me check what's there: package.json for the Next version and deps, lib/db.ts for the user model, ",
  "and the notes API since that's what needs protecting.\n\n",
  "lib/db.ts already has a User type with passwordHash, good — so passwords should be hashed with bcrypt, never stored raw. ",
  "SHA-256 is too fast for passwords; bcrypt's cost factor makes brute force expensive.\n\n",
  "For the token: store the JWT in an httpOnly, Secure, SameSite=Lax cookie rather than localStorage so page scripts can't read it (XSS). ",
  "Short-lived access token (15 min) signed with HS256 using a secret from env. ",
  "Verification must check the signature, the algorithm, and exp.\n\n",
  "Then middleware to guard /notes and /api/notes, and a login page with a server action or route handler. ",
  "I'll use `jose` since it works in the Edge runtime where Next middleware runs.",
];

const AUTH_RESULT: MainResult = {
  complexity: "task",
  summary:
    "Added email/password login with bcrypt-hashed passwords, a signed 15-minute JWT in an httpOnly cookie, and middleware that protects /notes and /api/notes.",
  steps: [
    { kind: "read", title: "package.json", lang: "", content: "Check the Next.js version and existing dependencies before adding auth libraries." },
    { kind: "read", title: "lib/db.ts", lang: "", content: "See the existing User model — it already has a passwordHash field to build on." },
    { kind: "read", title: "app/api/notes/route.ts", lang: "", content: "This is the API that needs protecting; notes currently have no owner." },
    { kind: "read", title: ".env.example", lang: "", content: "Find where to document the new JWT secret." },
    {
      kind: "plan",
      title: "Plan",
      lang: "",
      content: `1. **Hash passwords with bcrypt** (cost 12) — never store or compare plaintext.
2. **Issue a short-lived JWT** (HS256, 15 min) on successful login, signed with \`JWT_SECRET\`.
3. **Store it in an httpOnly, Secure, SameSite=Lax cookie**, not localStorage, so page scripts can't read it.
4. **Verify in middleware**: signature, allowed algorithm, and \`exp\` — redirect or 401 when invalid.
5. **Login page + route handler** for the form.

*Refresh-token rotation is a follow-up; it's noted at the end.*`,
    },
    { kind: "command", title: "Install dependencies", lang: "bash", content: "npm install jose bcryptjs\nnpm install -D @types/bcryptjs" },
    {
      kind: "file",
      title: "lib/auth.ts",
      lang: "ts",
      content: `import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
export const SESSION_COOKIE = "session";
const TOKEN_TTL = "15m";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12); // cost factor 12 ≈ 250ms per hash
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(userId: string, email: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    // Checks signature and exp; pins the algorithm so "alg: none" or RS/HS confusion is rejected.
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}
`,
    },
    {
      kind: "file",
      title: "app/api/login/route.ts",
      lang: "ts",
      content: `import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signToken, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = db.users.findByEmail(String(email).toLowerCase());

  // Same error for unknown user and wrong password — don't reveal which emails exist.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signToken(user.id, user.email);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  return Response.json({ ok: true });
}
`,
    },
    {
      kind: "file",
      title: "middleware.ts",
      lang: "ts",
      content: `import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/notes/:path*", "/api/notes/:path*"] };
`,
    },
    {
      kind: "file",
      title: "app/login/page.tsx",
      lang: "tsx",
      content: `"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/notes";
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    if (res.ok) router.push(next);
    else setError((await res.json()).error);
  }

  return (
    <main>
      <h1>Log in</h1>
      <form onSubmit={onSubmit}>
        <input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
        <button type="submit">Log in</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
`,
    },
    {
      kind: "file",
      title: ".env.example",
      lang: "bash",
      content: `# Copy to .env.local
DATABASE_URL=
# 32+ random bytes, e.g. \`openssl rand -base64 32\`
JWT_SECRET=
`,
    },
    {
      kind: "note",
      title: "Verify & follow-ups",
      lang: "",
      content: `**Verify:** visit \`/notes\` logged out → redirected to \`/login\`; a bad password returns the same error as an unknown email; the \`session\` cookie is httpOnly in devtools.

**Follow-ups:** add refresh-token rotation so users aren't logged out every 15 minutes; set \`ownerId\` on notes and filter by the logged-in user; rate-limit \`/api/login\`.`,
    },
  ],
};

export type MockResponse = { thinking: string[]; result: MainResult };

export function mockResponse(prompt: string): MockResponse {
  if (/auth|login|jwt|sign.?in/i.test(prompt)) {
    return { thinking: AUTH_THINKING, result: AUTH_RESULT };
  }
  if (/capital of france/i.test(prompt)) {
    return {
      thinking: ["Simple factual question."],
      result: {
        complexity: "trivial",
        summary: "Answered a factual question.",
        steps: [{ kind: "answer", title: "Answer", lang: "", content: "The capital of France is **Paris**." }],
      },
    };
  }
  return {
    thinking: ["(Simulated) No API key is configured, so this is a placeholder response."],
    result: {
      complexity: "trivial",
      summary: "Placeholder response in mock mode.",
      steps: [
        {
          kind: "answer",
          title: "Answer",
          lang: "",
          content:
            "_Mock mode:_ only the **auth page** and **capital of France** tasks have scripted responses. Set `ANTHROPIC_API_KEY` to run real model calls for any task.",
        },
      ],
    },
  };
}

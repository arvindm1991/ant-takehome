// Simulated existing repository (SPEC D18). The main agent is told it is working
// inside this repo; the file tree also renders in the sidebar.

export type RepoFile = { path: string; content: string };

export const REPO_NAME = "acme-notes";

export const ACME_NOTES: RepoFile[] = [
  {
    path: "package.json",
    content: `{
  "name": "acme-notes",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },
  "dependencies": {
    "next": "15.2.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "zod": "3.24.1"
  }
}
`,
  },
  {
    path: "README.md",
    content: `# acme-notes

Tiny notes app. Anyone can read and write notes right now — there is no login yet.

- \`lib/db.ts\` is an in-memory store (swap for Postgres later).
- API lives under \`app/api\`.
`,
  },
  {
    path: ".env.example",
    content: `# Copy to .env.local
DATABASE_URL=
`,
  },
  {
    path: "next.config.js",
    content: `/** @type {import('next').NextConfig} */
module.exports = { reactStrictMode: true };
`,
  },
  {
    path: "lib/db.ts",
    content: `export type User = { id: string; email: string; passwordHash: string };
export type Note = { id: string; ownerId: string | null; body: string; createdAt: number };

const users = new Map<string, User>();
const notes = new Map<string, Note>();

export const db = {
  users: {
    findByEmail: (email: string) => [...users.values()].find((u) => u.email === email) ?? null,
    create: (u: User) => (users.set(u.id, u), u),
  },
  notes: {
    list: () => [...notes.values()].sort((a, b) => b.createdAt - a.createdAt),
    create: (n: Note) => (notes.set(n.id, n), n),
  },
};
`,
  },
  {
    path: "app/layout.tsx",
    content: `import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="nav">acme-notes</header>
        {children}
      </body>
    </html>
  );
}
`,
  },
  {
    path: "app/page.tsx",
    content: `import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Welcome to acme-notes</h1>
      <Link href="/notes">Go to your notes →</Link>
    </main>
  );
}
`,
  },
  {
    path: "app/notes/page.tsx",
    content: `import { db } from "@/lib/db";

export default function NotesPage() {
  const notes = db.notes.list();
  return (
    <main>
      <h1>Notes</h1>
      <ul>{notes.map((n) => <li key={n.id}>{n.body}</li>)}</ul>
    </main>
  );
}
`,
  },
  {
    path: "app/api/notes/route.ts",
    content: `import { db } from "@/lib/db";

export async function GET() {
  return Response.json(db.notes.list());
}

export async function POST(req: Request) {
  const { body } = await req.json();
  const note = db.notes.create({ id: crypto.randomUUID(), ownerId: null, body, createdAt: Date.now() });
  return Response.json(note, { status: 201 });
}
`,
  },
  {
    path: "app/globals.css",
    content: `body { font-family: system-ui, sans-serif; margin: 0; }
.nav { padding: 12px 24px; border-bottom: 1px solid #eee; font-weight: 600; }
main { padding: 24px; }
`,
  },
  {
    path: "public/logo.svg",
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10"/></svg>
`,
  },
];

export function repoAsContext(files: RepoFile[] = ACME_NOTES): string {
  const tree = files.map((f) => `  ${f.path}`).join("\n");
  const bodies = files
    .map((f) => `<file path="${f.path}">\n${f.content}</file>`)
    .join("\n\n");
  return `<repository name="${REPO_NAME}">\n<tree>\n${tree}\n</tree>\n\n${bodies}\n</repository>`;
}

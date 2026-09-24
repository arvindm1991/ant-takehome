// Browser smoke test for the scripted (mock) demo path. Deterministic only in mock
// mode: run the app without ANTHROPIC_API_KEY (or with MOCK_MAIN=1 MOCK_LEARN=1).
//
//   npm run build && npx next start -p 3100 &
//   BASE_URL=http://localhost:3100 node e2e/smoke.mjs
//
// Needs Playwright (`npm i -D playwright` or set PLAYWRIGHT_MODULE to an install path).
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";

const browser = await chromium.launch();
const errors = [];
let failed = 0;
let current = null;

async function page(device) {
  const ctx = await browser.newContext(device ?? { viewport: { width: 1600, height: 1000 } });
  const p = await ctx.newPage();
  current = p;
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await p.goto(BASE);
  return p;
}

async function journey(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}\n  ${String(e.message ?? e).split("\n")[0]}`);
    if (process.env.SHOTS_DIR && current) await current.screenshot({ path: `${process.env.SHOTS_DIR}/fail-${name.slice(0, 2)}.png` }).catch(() => {});
  }
}

const moves = async (p) => p.locator('[aria-label="Where next"] [data-move-label]').allInnerTexts();
const expectMoves = async (p, want) => {
  await p.locator('[aria-label="Where next"] button').first().waitFor({ timeout: 8000 });
  const got = await moves(p);
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`next moves ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
};
const clickMove = (p, label) => p.locator('[aria-label="Where next"] button', { hasText: label }).click();
const answerWith = async (p, text) => {
  await p.getByLabel("Your answer").last().fill(text, { timeout: 10000 });
  await p.getByRole("button", { name: "Check my answer" }).click();
};

async function startLearning(p, goal) {
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("Learn while Claude builds this").click({ timeout: 8000 });
  await p.getByText(goal).waitFor({ timeout: 8000 });
  const cards = await p.locator("aside ol > li").count();
  if (cards < 4) throw new Error(`expected 4–5 goal cards, got ${cards}`);
  await p.getByText(goal).click();
}

await journey("J1a orient goal: goal cards → approach MCQ → pre-emptive prediction → cross-check → next moves", async () => {
  const p = await page();
  await startLearning(p, "Find where login plugs into this repo");
  await p.getByRole("button", { name: "package.json" }).click({ timeout: 8000 });
  await p.getByRole("button", { name: "lib/db.ts" }).click();
  await p.getByText(/^Lock in/).click();
  await answerWith(p, "In middleware: it runs before every route, so a single check guards all protected paths.");
  await p.getByText("Nailed it", { exact: true }).first().waitFor({ timeout: 8000 });
  await p.getByText("Cross-check").waitFor({ timeout: 30000 });
  await expectMoves(p, ["Dig deeper", "Try it hands-on", "Zoom out"]);
});

await journey("J1b JWT goal: visualizer + prediction → hands-on lab → miss → hint → retry → proactive check-in → dig deeper → recap", async () => {
  const p = await page();
  await startLearning(p, "Explain what a server must check before it trusts a JWT");
  await p.frameLocator('iframe[title="JWT visualizer"]').getByText("Signature", { exact: true }).click({ timeout: 10000 }); // interactive first
  await answerWith(p, "Verify the signature with the secret, check the expiry exp, and pin the algorithm.");
  await p.getByText("Nailed it", { exact: true }).first().waitFor({ timeout: 8000 });
  await expectMoves(p, ["Dig deeper", "Try it hands-on", "Zoom out"]);
  await clickMove(p, "Try it hands-on");
  const lab = p.frameLocator('iframe[title="JWT tamper lab"]');
  await lab.locator("#verdict", { hasText: "Accepted" }).waitFor({ timeout: 10000 });
  await lab.getByText("Attacker edits payload").click();
  await lab.locator("#role").selectOption("admin");
  await lab.locator("#verdict", { hasText: "Rejected" }).waitFor({ timeout: 5000 });
  await answerWith(p, "No idea.");
  await p.getByText("Not quite", { exact: true }).waitFor({ timeout: 8000 });
  await expectMoves(p, ["Hint", "See how it works", "Show me in Claude's code"]);
  await clickMove(p, "Hint");
  await p.getByText("Hint", { exact: true }).first().waitFor({ timeout: 8000 });
  await answerWith(p, "Editing the payload breaks the HMAC signature made with the secret; alg none is rejected because the algorithm is pinned to HS256.");
  await p.getByText("Nailed it", { exact: true }).last().waitFor({ timeout: 8000 });
  await p.getByText("Check my prediction").click({ timeout: 40000 }); // proactive check-in once Claude writes lib/auth.ts
  await p.getByText(/Which of the three did your prediction cover/).waitFor({ timeout: 8000 });
  await expectMoves(p, ["Quiz me on this", "Dig deeper", "Zoom out"]);
  await clickMove(p, "Dig deeper");
  await answerWith(p, "The HMAC signature needs the secret key; without JWT_SECRET they can't produce a valid signature over the edited payload.");
  await p.getByText("Session recap").waitFor({ timeout: 10000 });
  await p.getByText("How your mastery moved").waitFor();
  await p.getByRole("button", { name: "Your progress" }).click();
  await p.getByText("JWT auth", { exact: true }).first().waitFor();
});

await journey("J2 post-task: completion chip → goal cards → explain-back", async () => {
  const p = await page();
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("Want to understand it before you review it?").click({ timeout: 60000 });
  await p.getByText("Tell a teammate why bcrypt beats SHA-256").click({ timeout: 8000 });
  await p.getByPlaceholder("Explain it in your own words…").waitFor({ timeout: 8000 });
});

await journey("J4 quick question: instant answer, no learn chip", async () => {
  const p = await page();
  await p.getByRole("button", { name: /Quick question/ }).click();
  await p.getByText("Paris").waitFor();
  await p.waitForTimeout(1500);
  if ((await p.getByText(/Learn while Claude builds|understand it before you review/).count()) !== 0) throw new Error("chip shown for a trivial ask");
});

await journey("Suggestions in Claude's thread can be dismissed and stay dismissed for that task", async () => {
  const p = await page();
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("Learn while Claude builds this").waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: "Dismiss" }).first().click();
  await p.waitForTimeout(500);
  if ((await p.getByText("Learn while Claude builds this").count()) !== 0) throw new Error("live suggestion still shown");
  await p.waitForTimeout(40000); // let Claude finish: the post-task suggestion should not reappear for this task
  if ((await p.getByText("understand it before you review it").count()) !== 0) throw new Error("post-task suggestion shown after dismissal");
});

await journey("Toggle first → learn mode starts on its own; one text box answers, then asks; task requests redirect", async () => {
  const p = await page();
  await p.getByRole("switch").click();
  await p.getByText("Learn mode is on.").waitFor();
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("Explain what a server must check before it trusts a JWT").click({ timeout: 8000 }); // no chip click needed
  await answerWith(p, "Verify the signature with the secret, check the expiry exp, and pin the algorithm.");
  await p.getByText("Nailed it", { exact: true }).first().waitFor({ timeout: 8000 });
  await p.getByLabel("Ask about what Claude just did").fill("why pin the algorithm?"); // no open question → the box asks
  await p.getByRole("button", { name: "Ask", exact: true }).click();
  await p.getByText("You asked", { exact: true }).waitFor({ timeout: 8000 });
  await p.getByLabel("Ask about what Claude just did").fill("add a logout button");
  await p.getByRole("button", { name: "Ask", exact: true }).click();
  await p.getByText(/one for Claude: ask in the main chat/).waitFor({ timeout: 8000 });
});

await journey("J3 refreshers: persist → +3 days → Inbox refresher → interleave → recurrence", async () => {
  const p = await page();
  await startLearning(p, "Explain what a server must check before it trusts a JWT");
  await answerWith(p, "Something about the payload?");
  await p.getByText(/Partly there|Not quite/).first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(30000); // let the main agent finish
  await p.reload();
  await p.getByText("Build a login page with JWT aut").first().waitFor({ timeout: 5000 });
  await p.getByLabel(/learning refreshers due/).click();
  await p.getByRole("button", { name: "+3 days" }).click();
  if ((await p.getByText("Start refresher · ~1 min").count()) < 1) throw new Error("no refreshers due after +3 days");
  await p.getByText("Start refresher · ~1 min").first().click();
  await answerWith(p, "The payload is only base64 so anyone can read it; the HMAC signature with the secret stops tampering.");
  await p.getByText("Session recap").waitFor({ timeout: 10000 });
  await p.getByRole("button", { name: "New", exact: true }).click();
  await p.getByRole("button", { name: /rate limiting/ }).click();
  await p.getByText(/This builds on/).click({ timeout: 8000 });
  await p.getByPlaceholder("What would happen?").waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: "New", exact: true }).click();
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText(/You practised/).first().waitFor({ timeout: 8000 });
});

await journey("Phone: drawer → chip → goal sheet → answer → peek bar → anchor steps aside → no sideways scroll", async () => {
  const p = await page(devices["iPhone 13"]);
  await p.getByLabel("Open chats").click();
  await p.getByRole("button", { name: "New", exact: true }).click(); // closes the drawer
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("Learn while Claude builds this").click({ timeout: 8000 });
  await p.getByText("Find where login plugs into this repo").waitFor({ timeout: 8000 });
  if (!(await p.getByText("Find where login plugs into this repo").isVisible())) throw new Error("first goal card not in view");
  await p.getByText("Explain what a server must check before it trusts a JWT").click();
  await answerWith(p, "Verify the signature with the secret, check the expiry exp, and pin the algorithm.");
  await p.getByText("Nailed it", { exact: true }).first().waitFor({ timeout: 8000 });
  await p.getByLabel("Minimize learn mode").click();
  await p.getByLabel("Open learn mode").waitFor();
  await p.getByLabel("Open learn mode").click();
  await p.getByText("Check my prediction").click({ timeout: 40000 });
  await p.getByText(/Which of the three did your prediction cover/).waitFor({ timeout: 8000 }); // reply stays in view
  await p.locator('aside[aria-label="Learn mode"] button', { hasText: "lib/auth.ts ↗" }).first().click();
  await p.getByLabel("Open learn mode").waitFor({ timeout: 3000 }); // sheet stepped aside for the code
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error(`page scrolls sideways by ${overflow}px`);
});

await browser.close();
if (errors.length) console.log(`console/page errors:\n  ${errors.join("\n  ")}`);
process.exit(failed || errors.length ? 1 : 0);

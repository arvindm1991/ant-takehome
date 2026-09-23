// Browser smoke test for the scripted (mock) demo path. Deterministic only in mock
// mode: run the app without ANTHROPIC_API_KEY (or with MOCK_MAIN=1 MOCK_LEARN=1).
//
//   npm run build && npx next start -p 3100 &
//   BASE_URL=http://localhost:3100 node e2e/smoke.mjs
//
// Needs Playwright (`npm i -D playwright` or set PLAYWRIGHT_MODULE to an install path).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PRED = /prediction|own words/;

const browser = await chromium.launch();
const errors = [];
let failed = 0;
let current = null;

async function page() {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
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

async function learnUntilWhatIf(p, objective, predictAnswer) {
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("Learn while Claude builds this").click({ timeout: 8000 });
  await p.getByText(objective).click({ timeout: 8000 });
  await p.getByRole("button", { name: "package.json" }).click({ timeout: 8000 });
  await p.getByRole("button", { name: "lib/db.ts" }).click();
  await p.getByText(/^Lock in/).click();
  await p.getByPlaceholder(PRED).fill(predictAnswer, { timeout: 8000 });
  await p.getByText("Commit answer").click();
  await p.getByText("Nailed it").first().waitFor({ timeout: 8000 });
}

await journey("J1 live: objectives → approach MCQ → predict → cross-check → widget → what-if → hint → recap", async () => {
  const p = await page();
  await learnUntilWhatIf(p, "How JWTs are signed and verified", "Verify the signature with the secret and check exp.");
  const lab = p.frameLocator("iframe");
  // The lab re-renders asynchronously (WebCrypto HMAC), so wait for the text.
  await lab.locator("#verdict", { hasText: "Accepted" }).waitFor({ timeout: 10000 });
  await lab.getByText("Attacker edits payload").click();
  await lab.locator("#verdict", { hasText: "nothing changed yet" }).waitFor({ timeout: 5000 });
  await lab.locator("#role").selectOption("admin");
  await lab.locator("#verdict", { hasText: "Rejected" }).waitFor({ timeout: 5000 });
  await p.getByText("Cross-check").waitFor({ timeout: 30000 });
  await p.getByPlaceholder("What would happen?").fill("The page loads slower.");
  await p.getByText("Commit answer").click();
  await p.getByText("Hint", { exact: true }).waitFor({ timeout: 10000 });
  await p.getByPlaceholder("What would happen?").fill("A leaked signed token never expires, so an attacker keeps access forever.");
  await p.getByText("Commit answer").click();
  await p.getByText("Session complete").waitFor({ timeout: 10000 });
  await p.getByRole("button", { name: "Your progress" }).click();
  await p.getByText("JWT auth", { exact: true }).first().waitFor();
});

await journey("J2 post-task: chip after completion → explain-back", async () => {
  const p = await page();
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("Want to understand it before you review it?").click({ timeout: 60000 });
  await p.getByText("Why bcrypt, not SHA-256").click({ timeout: 8000 });
  await p.getByRole("button", { name: "package.json" }).click({ timeout: 8000 });
  await p.getByText(/^Lock in/).click();
  await p.getByText("Cross-check").waitFor({ timeout: 8000 });
  await p.getByPlaceholder("Explain it in your own words…").waitFor({ timeout: 8000 });
});

await journey("J4 quick question: instant answer, no learn chip", async () => {
  const p = await page();
  await p.getByRole("button", { name: /Quick question/ }).click();
  await p.getByText("Paris").waitFor();
  await p.waitForTimeout(1500);
  if ((await p.getByText(/Learn while Claude builds|understand it before you review/).count()) !== 0) throw new Error("chip shown for a trivial ask");
});

await journey("Toggle first: learn mode on before sending auto-starts a session", async () => {
  const p = await page();
  await p.getByRole("switch").click();
  await p.getByText("Learn mode is on.").waitFor();
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText("How JWTs are signed and verified").waitFor({ timeout: 8000 });
});

await journey("J3 refreshers: persist → +3 days → Inbox refresher → interleave → recurrence", async () => {
  const p = await page();
  await learnUntilWhatIf(p, "How JWTs are signed and verified", "Check the signature with the secret and the exp.");
  await p.getByPlaceholder("What would happen?").fill("Nothing much.", { timeout: 15000 });
  await p.getByText("Commit answer").click();
  await p.getByText("Hint", { exact: true }).waitFor({ timeout: 10000 });
  await p.waitForTimeout(30000); // let the main agent finish
  await p.reload();
  await p.getByText("Build a login page with JWT aut").first().waitFor({ timeout: 5000 });
  await p.getByLabel(/learning refreshers due/).click();
  await p.getByRole("button", { name: "+3 days" }).click();
  const due = await p.getByText("Start refresher · ~1 min").count();
  if (due < 1) throw new Error("no refreshers due after +3 days");
  await p.getByText("Start refresher · ~1 min").first().click();
  await p.getByPlaceholder(/own words/).fill("package.json for dependencies, lib/db.ts for the data model, and the API routes that need protecting; base64 payload, signature with secret.");
  await p.getByText("Commit answer").click();
  await p.getByText("Session complete").waitFor({ timeout: 10000 });
  await p.getByRole("button", { name: "New", exact: true }).click();
  await p.getByRole("button", { name: /rate limiting/ }).click();
  await p.getByText(/This builds on/).click({ timeout: 8000 });
  await p.getByPlaceholder("What would happen?").waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: "New", exact: true }).click();
  await p.getByRole("button", { name: /Primary demo/ }).click();
  await p.getByText(/You practised/).first().waitFor({ timeout: 8000 });
});

await browser.close();
if (errors.length) console.log(`console/page errors:\n  ${errors.join("\n  ")}`);
process.exit(failed || errors.length ? 1 : 0);
